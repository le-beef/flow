import { pool, query } from "./db.js";
import { normalize, isOpen } from "./rules.js";
import { enqueue } from "./queue.js";

async function storeOut(
  conversationId: string,
  text: string,
  sender = "bot",
  mediaUrl?: string | null,
) {
  const r = await query(
    `INSERT INTO messages(conversation_id,direction,sender,type,content,media_url,status) VALUES($1,'out',$2,$3,$4,$5,'pending') RETURNING *`,
    [conversationId, sender, mediaUrl ? "media" : "text", text, mediaUrl],
  );
  return r.rows[0];
}
function renderTemplate(
  text: string,
  context: { customer: any; settings: any },
) {
  const company = context.settings.company_profile || {};
  const variables: Record<string, string> = {
    nome: context.customer.name || "cliente",
    cliente: context.customer.name || "cliente",
    empresa: company.name || "nossa empresa",
    telefone: company.phone || "",
    endereco: company.address || "",
  };
  return text.replace(
    /\{\{\s*(\w+)\s*\}\}/g,
    (_match, key) => variables[key] ?? "",
  );
}
export async function processIncoming(input: {
  phone: string;
  name?: string;
  text: string;
  evolutionId?: string;
}) {
  const settings = Object.fromEntries(
    (
      await query<{ key: string; value: any }>("SELECT key,value FROM settings")
    ).rows.map((x) => [x.key, x.value]),
  );
  const openNow = isOpen(settings.business_hours || {});
  const client = await pool.connect();
  let customer: any,
    conversation: any,
    shouldGreet = false;
  try {
    await client.query("BEGIN");
    customer = (
      await client.query(
        `INSERT INTO customers(phone,name) VALUES($1,$2) ON CONFLICT(phone) DO UPDATE SET name=COALESCE(EXCLUDED.name,customers.name),updated_at=now() RETURNING *`,
        [input.phone, input.name],
      )
    ).rows[0];
    if (
      customer.automation_paused &&
      customer.automation_paused_until &&
      new Date(customer.automation_paused_until).getTime() <= Date.now()
    ) {
      customer = (
        await client.query(
          `UPDATE customers SET automation_paused=false,automation_paused_until=NULL WHERE id=$1 RETURNING *`,
          [customer.id],
        )
      ).rows[0];
      await client.query(
        `UPDATE conversations SET status='bot',assigned_to=NULL WHERE customer_id=$1 AND status<>'closed'`,
        [customer.id],
      );
    }
    conversation = (
      await client.query(
        `SELECT * FROM conversations WHERE customer_id=$1 AND status<>'closed' FOR UPDATE`,
        [customer.id],
      )
    ).rows[0];
    if (!conversation)
      conversation = (
        await client.query(
          `INSERT INTO conversations(customer_id) VALUES($1) RETURNING *`,
          [customer.id],
        )
      ).rows[0];
    const inserted = await client.query(
      `INSERT INTO messages(conversation_id,evolution_id,direction,sender,content) VALUES($1,$2,'in','customer',$3) ON CONFLICT(evolution_id) DO NOTHING`,
      [conversation.id, input.evolutionId || null, input.text],
    );
    if (!inserted.rowCount) {
      await client.query("COMMIT");
      return { conversationId: conversation.id, replies: [] };
    }
    if (
      !customer.automation_paused &&
      settings.automation_enabled !== false &&
      openNow
    ) {
      const greeted =
        customer.last_greeting_at &&
        Date.now() - new Date(customer.last_greeting_at).getTime() < 86400000;
      if (!greeted) {
        shouldGreet = true;
        await client.query(
          `UPDATE customers SET last_greeting_at=now() WHERE id=$1`,
          [customer.id],
        );
      }
    }
    await client.query(
      `UPDATE conversations SET unread_count=unread_count+1,updated_at=now() WHERE id=$1`,
      [conversation.id],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  if (customer.automation_paused)
    return { conversationId: conversation.id, replies: [] };
  if (settings.automation_enabled === false)
    return { conversationId: conversation.id, replies: [] };
  const cooldown = Number(settings.automation_cooldown_seconds || 3) * 1000;
  if (
    customer.last_auto_response_at &&
    Date.now() - new Date(customer.last_auto_response_at).getTime() < cooldown
  )
    return { conversationId: conversation.id, replies: [] };
  let reply: any = null;
  if (!openNow) reply = { text: String(settings.closed_message) };
  else {
    const n = Number(normalize(input.text));
    if (Number.isInteger(n))
      reply = (
        await query(
          `SELECT response AS text,action,media_type AS "mediaType",media_url AS "mediaUrl" FROM menu_items WHERE option_number=$1 AND active`,
          [n],
        )
      ).rows[0];
    if (!reply) {
      const body = normalize(input.text);
      const triggers = (
        await query(
          `SELECT response AS text,keywords,media_type AS "mediaType",media_url AS "mediaUrl" FROM triggers WHERE active ORDER BY priority DESC,created_at`,
        )
      ).rows as any[];
      reply = triggers.find((t) =>
        t.keywords.some((k: string) => body.includes(normalize(k))),
      );
    }
    if (!reply && settings.fallback_enabled)
      reply = { text: String(settings.fallback_message) };
    if (shouldGreet)
      reply = reply
        ? { ...reply, text: `${String(settings.greeting)}\n\n${reply.text}` }
        : { text: String(settings.greeting) };
  }
  if (!reply) return { conversationId: conversation.id, replies: [] };
  if (reply.action === "human") {
    await query(
      `UPDATE customers SET automation_paused=true,automation_paused_until=now()+interval '24 hours' WHERE id=$1`,
      [customer.id],
    );
    await query(
      `UPDATE conversations SET status='waiting',updated_at=now() WHERE id=$1`,
      [conversation.id],
    );
  }
  reply.text = renderTemplate(String(reply.text), { customer, settings });
  await query(`UPDATE customers SET last_auto_response_at=now() WHERE id=$1`, [
    customer.id,
  ]);
  const message = await storeOut(
    conversation.id,
    reply.text,
    "bot",
    reply.mediaUrl,
  );
  await enqueue(
    message.id,
    input.phone,
    reply.text,
    reply.mediaType,
    reply.mediaUrl,
  );
  return {
    conversationId: conversation.id,
    replies: [message],
    status: reply.action === "human" ? "waiting" : conversation.status,
  };
}
