import { query } from "./db.js";
import { sendWhatsApp, showTyping } from "./evolution.js";
import { randomTypingDelay } from "./rules.js";
import { getLicenseStatus } from "./license.js";
import { systemLog } from "./auth.js";
export async function enqueue(
  messageId: string,
  phone: string,
  text: string,
  mediaType?: string | null,
  mediaUrl?: string | null,
) {
  await query(
    `INSERT INTO outbound_queue(message_id,phone,text,media_type,media_url) VALUES($1,$2,$3,$4,$5)`,
    [messageId, phone, text, mediaType || null, mediaUrl || null],
  );
}
let running = false;
export async function processQueue() {
  if (running || !(await getLicenseStatus()).active) return;
  running = true;
  try {
    const jobs = (
      await query<any>(
        `UPDATE outbound_queue SET status='processing',attempts=attempts+1,updated_at=now() WHERE id IN(SELECT id FROM outbound_queue WHERE status IN('pending','failed') AND next_attempt_at<=now() AND attempts<5 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 5) RETURNING *`,
      )
    ).rows;
    for (const job of jobs) {
      try {
        try {
          await showTyping(job.phone, randomTypingDelay());
        } catch {}
        await sendWhatsApp({
          number: job.phone,
          text: job.text,
          mediaType: job.media_type,
          mediaUrl: job.media_url,
        });
        await query(
          `UPDATE outbound_queue SET status='sent',updated_at=now() WHERE id=$1`,
          [job.id],
        );
        await query(`UPDATE messages SET status='sent' WHERE id=$1`, [
          job.message_id,
        ]);
      } catch (e: any) {
        const terminal = job.attempts >= 5;
        await query(
          `UPDATE outbound_queue SET status=$2,last_error=$3,next_attempt_at=now()+($4||' seconds')::interval,updated_at=now() WHERE id=$1`,
          [
            job.id,
            terminal ? "failed" : "pending",
            String(e?.message || e).slice(0, 500),
            Math.min(60, 2 ** job.attempts),
          ],
        );
        await query(`UPDATE messages SET status=$2 WHERE id=$1`, [
          job.message_id,
          terminal ? "failed" : "pending",
        ]);
        if (terminal)
          await systemLog(
            "error",
            "queue",
            "message_failed",
            "Mensagem falhou após cinco tentativas",
            { jobId: job.id, phone: job.phone, error: String(e?.message || e) },
          );
      }
    }
  } finally {
    running = false;
  }
}
export function startQueue() {
  setInterval(() => processQueue().catch(console.error), 1000);
  processQueue().catch(console.error);
}
