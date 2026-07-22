import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { routes } from "./routes.js";
import { processIncoming } from "./automation.js";
import { auth, ensureAdmin, sign, verifyPassword, systemLog } from "./auth.js";
import { query, runMigrations } from "./db.js";
import { startQueue } from "./queue.js";
import { licenseRoutes, licenseGuard, getLicenseStatus } from "./license.js";
const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: config.WEB_URL } });
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: config.WEB_URL }));
app.use(express.json({ limit: "25mb" }));
app.use(
  "/uploads",
  express.static(fileURLToPath(new URL("../uploads", import.meta.url))),
);
app.post(
  "/api/auth/login",
  rateLimit({ windowMs: 15 * 60_000, limit: 20 }),
  async (req, res) => {
    const user = (
      await query<any>("SELECT * FROM users WHERE email=$1 AND active", [
        req.body?.email,
      ])
    ).rows[0];
    if (user?.locked_until && new Date(user.locked_until) > new Date())
      return res.status(429).json({
        error: "Acesso temporariamente bloqueado. Tente novamente mais tarde.",
      });
    const valid =
      user &&
      (await verifyPassword(
        String(req.body?.password || ""),
        user.password_hash,
      ));
    if (!valid) {
      if (user) {
        await query(
          `UPDATE users SET failed_attempts=failed_attempts+1,locked_until=CASE WHEN failed_attempts+1>=5 THEN now()+interval '15 minutes' ELSE locked_until END WHERE id=$1`,
          [user.id],
        );
        await systemLog(
          "warn",
          "auth",
          "login_failed",
          "Tentativa de login inválida",
          { email: req.body?.email },
        );
      }
      return res.status(401).json({ error: "E-mail ou senha inválidos" });
    }
    await query(
      "UPDATE users SET failed_attempts=0,locked_until=NULL,last_login_at=now(),last_seen_at=now() WHERE id=$1",
      [user.id],
    );
    res.json({
      token: sign(user),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.must_change_password,
      },
    });
  },
);
app.use("/api/license", auth, licenseRoutes);
app.use("/api", auth, licenseGuard, routes);
app.post("/webhooks/evolution", async (req, res, next) => {
  try {
    const secret =
      req.header("x-webhook-secret") || String(req.query.secret || "");
    if (secret !== config.EVOLUTION_WEBHOOK_SECRET)
      return res.status(401).json({ error: "Não autorizado" });
    if (!(await getLicenseStatus()).active)
      return res.status(402).json({ error: "Licença inativa" });
    const d = req.body?.data;
    const key = d?.key;
    if (!key || key.fromMe || String(key.remoteJid || "").endsWith("@g.us"))
      return res.status(204).end();
    const phone = String(key.remoteJid || "").replace(/@.*/, "");
    const text =
      d.message?.conversation || d.message?.extendedTextMessage?.text || "";
    if (!text) return res.status(204).end();
    const result = await processIncoming({
      phone,
      name: d.pushName,
      text,
      evolutionId: key.id,
    });
    io.emit("conversation:update", result);
    res.status(202).json({ accepted: true });
  } catch (e) {
    next(e);
  }
});
app.use((e: any, _req: any, res: any, _next: any) => {
  console.error(e);
  systemLog("error", "api", "request_error", e?.message || "Erro interno", {
    stack: String(e?.stack || "").slice(0, 2000),
  });
  res.status(500).json({ error: e?.message || "Erro interno" });
});
runMigrations()
  .then(ensureAdmin)
  .then(() => {
    startQueue();
    server.listen(config.PORT, () =>
      console.log(`API em http://localhost:${config.PORT}`),
    );
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
