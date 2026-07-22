import { Router } from "express";
import multer from "multer";
import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { pool, query } from "./db.js";
import { config } from "./config.js";
import {
  audit,
  type Authed,
  adminOnly,
  hashPassword,
  temporaryPassword,
  verifyPassword,
} from "./auth.js";
import {
  checkForUpdate,
  downloadAvailableUpdate,
  preparedUpdate,
  updateStatus,
} from "./updater.js";

export const routes = Router();
const uploadDir = fileURLToPath(new URL("../uploads", import.meta.url));
mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_r, f, cb) =>
    cb(null, /^(image\/|audio\/|application\/pdf)/.test(f.mimetype)),
});
routes.get("/health", (_, res) => res.json({ ok: true }));
routes.get("/system/update", adminOnly, async (_req, res) => {
  res.json(await checkForUpdate());
});
routes.get("/system/update/status", adminOnly, async (_req, res) => {
  res.json(await updateStatus());
});
routes.post("/system/update/download", adminOnly, async (req: Authed, res) => {
  const update = await downloadAvailableUpdate();
  await audit(req, "update_downloaded", "system", update.manifest.version, {
    sha256: update.sha256,
    size: update.size,
  });
  res.json({
    ready: true,
    version: update.manifest.version,
    sha256: update.sha256,
    size: update.size,
  });
});
routes.post("/system/update/install", adminOnly, async (req: Authed, res) => {
  const update = await preparedUpdate();
  await audit(req, "update_started", "system", update.manifest.version, {
    sha256: update.sha256,
  });
  const script = fileURLToPath(new URL("../../../scripts/apply-update.ps1", import.meta.url));
  const child = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-WindowStyle",
      "Hidden",
      "-File",
      script,
      "-Package",
      update.packagePath,
      "-ExpectedVersion",
      update.manifest.version,
      "-ExpectedHash",
      update.sha256,
    ],
    { detached: true, stdio: "ignore", windowsHide: true },
  );
  child.unref();
  res.status(202).json({
    started: true,
    version: update.manifest.version,
    message: "Atualização iniciada. O painel reiniciará automaticamente.",
  });
});
routes.get("/dashboard", async (_, res) => {
  const [counts, recent] = await Promise.all([
    query(
      `SELECT count(*)::int customers,(SELECT count(*)::int FROM conversations c JOIN customers cu ON cu.id=c.customer_id WHERE c.status IN ('waiting','human') AND cu.automation_paused=true AND (cu.automation_paused_until IS NULL OR cu.automation_paused_until>now())) waiting,(SELECT count(*)::int FROM messages WHERE created_at>current_date) messages_today,(SELECT LEAST(100,COALESCE(round(100.0*count(*) FILTER(WHERE sender='bot')/NULLIF(count(*) FILTER(WHERE direction='in'),0)),0))::int FROM messages WHERE created_at>now()-interval '30 days') automation_rate FROM customers`,
    ),
    query(
      `SELECT c.*,cu.phone,cu.name,(SELECT content FROM messages WHERE conversation_id=c.id ORDER BY created_at DESC LIMIT 1) last_message FROM conversations c JOIN customers cu ON cu.id=c.customer_id ORDER BY c.updated_at DESC LIMIT 8`,
    ),
  ]);
  res.json({ stats: counts.rows[0], recent: recent.rows });
});
routes.get("/conversations", async (req, res) => {
  const s = String(req.query.search || "");
  const r = await query(
    `SELECT c.*,cu.phone,cu.name,(cu.automation_paused AND (cu.automation_paused_until IS NULL OR cu.automation_paused_until>now())) AS automation_paused,CASE WHEN c.status IN ('waiting','human') AND NOT (cu.automation_paused AND (cu.automation_paused_until IS NULL OR cu.automation_paused_until>now())) THEN 'bot' ELSE c.status END AS status,COALESCE(json_agg(DISTINCT jsonb_build_object('id',t.id,'name',t.name,'color',t.color)) FILTER(WHERE t.id IS NOT NULL),'[]') tags,(SELECT content FROM messages WHERE conversation_id=c.id ORDER BY created_at DESC LIMIT 1) last_message FROM conversations c JOIN customers cu ON cu.id=c.customer_id LEFT JOIN customer_tags ct ON ct.customer_id=cu.id LEFT JOIN tags t ON t.id=ct.tag_id WHERE ($1='' OR cu.name ILIKE '%'||$1||'%' OR cu.phone ILIKE '%'||$1||'%' OR EXISTS(SELECT 1 FROM messages m WHERE m.conversation_id=c.id AND m.content ILIKE '%'||$1||'%')) GROUP BY c.id,cu.id ORDER BY c.updated_at DESC`,
    [s],
  );
  res.json(r.rows);
});
routes.get("/conversations/:id/messages", async (req, res) => {
  await query(`UPDATE conversations SET unread_count=0 WHERE id=$1`, [
    req.params.id,
  ]);
  res.json(
    (
      await query(
        `SELECT * FROM messages WHERE conversation_id=$1 ORDER BY created_at`,
        [req.params.id],
      )
    ).rows,
  );
});
for (const resource of ["triggers", "menu_items", "tags"] as const) {
  routes.get("/" + resource, async (_, res) =>
    res.json(
      (
        await query(
          `SELECT * FROM ${resource} ORDER BY ${resource === "menu_items" ? "option_number" : resource === "triggers" ? "priority DESC, created_at" : "1"}`,
        )
      ).rows,
    ),
  );
  routes.post("/" + resource, adminOnly, async (req, res) => {
    const schemas = {
      triggers: z.object({
        name: z.string().trim().min(2),
        keywords: z.array(z.string().trim().min(1)).min(1),
        response: z.string().trim().min(1),
        mediaType: z.string().nullable().optional(),
        mediaUrl: z.string().nullable().optional(),
        active: z.boolean().optional(),
        priority: z.coerce.number().int().min(0).max(999).optional(),
      }),
      menu_items: z.object({
        optionNumber: z.coerce.number().int().min(1).max(99),
        label: z.string().trim().min(2),
        response: z.string().trim().min(1),
        action: z.enum(["reply", "human"]).optional(),
        mediaType: z.string().nullable().optional(),
        mediaUrl: z.string().nullable().optional(),
        active: z.boolean().optional(),
      }),
      tags: z.object({
        name: z.string().trim().min(2),
        color: z.string().regex(/^#[0-9a-f]{6}$/i),
      }),
    } as const;
    const parsed = schemas[resource].safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Confira os campos informados." });
    const b: any = parsed.data;
    let sql = "";
    let p: any[] = [];
    if (resource === "triggers") {
      sql = `INSERT INTO triggers(name,keywords,response,media_type,media_url,active,priority) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`;
      p = [
        b.name,
        b.keywords,
        b.response,
        b.mediaType || null,
        b.mediaUrl || null,
        b.active ?? true,
        Number(b.priority || 0),
      ];
    }
    if (resource === "menu_items") {
      sql = `INSERT INTO menu_items(option_number,label,response,action,media_type,media_url,active) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(option_number) DO UPDATE SET label=EXCLUDED.label,response=EXCLUDED.response,action=EXCLUDED.action,media_type=EXCLUDED.media_type,media_url=EXCLUDED.media_url,active=EXCLUDED.active RETURNING *`;
      p = [
        b.optionNumber,
        b.label,
        b.response,
        b.action || "reply",
        b.mediaType || null,
        b.mediaUrl || null,
        b.active ?? true,
      ];
    }
    if (resource === "tags") {
      sql = `INSERT INTO tags(name,color) VALUES($1,$2) RETURNING *`;
      p = [b.name, b.color];
    }
    try {
      res.status(201).json((await query(sql, p)).rows[0]);
    } catch (error: any) {
      if (error?.code === "23505")
        return res.status(409).json({ error: "Já existe um item com estes dados." });
      throw error;
    }
  });
  routes.patch(`/${resource}/:id`, adminOnly, async (req, res) => {
    const allowed: any = {
      triggers: [
        "name",
        "keywords",
        "response",
        "media_type",
        "media_url",
        "active",
      ],
      menu_items: [
        "label",
        "response",
        "action",
        "media_type",
        "media_url",
        "active",
      ],
      tags: ["name", "color"],
    };
    const entries = Object.entries(req.body)
      .map(([k, v]) => [k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase()), v])
      .filter(([k]) => allowed[resource].includes(k));
    const set = entries.map(([k], i) => `${k}=$${i + 2}`).join(",");
    if (!set) return res.status(400).json({ error: "Nenhum campo válido" });
    res.json(
      (
        await query(`UPDATE ${resource} SET ${set} WHERE id=$1 RETURNING *`, [
          req.params.id,
          ...entries.map((x) => x[1]),
        ])
      ).rows[0],
    );
  });
}
routes.post("/automation/test", adminOnly, async (req, res) => {
  const text = z.string().min(1).parse(req.body.text);
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const numeric = Number(normalized);
  if (Number.isInteger(numeric)) {
    const item = (
      await query(
        `SELECT id,label AS name,response,action,'menu' AS type FROM menu_items WHERE option_number=$1 AND active`,
        [numeric],
      )
    ).rows[0];
    if (item) return res.json({ matched: true, rule: item });
  }
  const triggers: any[] = (
    await query(
      `SELECT id,name,response,keywords,priority,'trigger' AS type FROM triggers WHERE active ORDER BY priority DESC,created_at`,
    )
  ).rows;
  const match = triggers.find((trigger) =>
    trigger.keywords.some((keyword: string) =>
      normalized.includes(
        keyword
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim(),
      ),
    ),
  );
  res.json(match ? { matched: true, rule: match } : { matched: false });
});
routes.get("/settings", async (_, res) =>
  res.json(
    Object.fromEntries(
      (
        await query<{ key: string; value: any }>(
          "SELECT key,value FROM settings",
        )
      ).rows.map((x) => [x.key, x.value]),
    ),
  ),
);
routes.put("/settings/:key", adminOnly, async (req, res) => {
  const allowedSettings = new Set([
    "company_profile",
    "greeting",
    "closed_message",
    "fallback_message",
    "fallback_enabled",
    "business_hours",
    "automation_enabled",
    "automation_cooldown_seconds",
    "setup_completed",
  ]);
  if (!allowedSettings.has(String(req.params.key)))
    return res.status(400).json({ error: "Configuração não permitida" });
  const r = await query(
    `INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=now() RETURNING *`,
    [req.params.key, JSON.stringify(req.body.value)],
  );
  res.json(r.rows[0]);
});
routes.get("/customers", async (_, res) =>
  res.json(
    (
      await query(
        `SELECT cu.*,COALESCE(json_agg(jsonb_build_object('id',t.id,'name',t.name,'color',t.color)) FILTER(WHERE t.id IS NOT NULL),'[]') tags FROM customers cu LEFT JOIN customer_tags ct ON ct.customer_id=cu.id LEFT JOIN tags t ON t.id=ct.tag_id GROUP BY cu.id ORDER BY cu.created_at DESC`,
      )
    ).rows,
  ),
);
routes.post("/customers/:id/tags/:tagId", async (req, res) => {
  await query(
    `INSERT INTO customer_tags VALUES($1,$2) ON CONFLICT DO NOTHING`,
    [req.params.id, req.params.tagId],
  );
  res.status(204).end();
});
routes.delete("/customers/:id/tags/:tagId", async (req, res) => {
  await query(`DELETE FROM customer_tags WHERE customer_id=$1 AND tag_id=$2`, [
    req.params.id,
    req.params.tagId,
  ]);
  res.status(204).end();
});
routes.post("/uploads", adminOnly, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Arquivo inválido" });
  const mediaType = req.file.mimetype.startsWith("image/")
    ? "image"
    : req.file.mimetype.startsWith("audio/")
      ? "audio"
      : "document";
  res.status(201).json({
    url: `${config.WEB_URL.replace(/:\d+$/, `:${config.PORT}`)}/uploads/${req.file.filename}`,
    type: mediaType,
    originalName: req.file.originalname,
  });
});
routes.get("/connection", async (_req, res) => {
  try {
    const headers = { apikey: config.EVOLUTION_API_KEY };
    const [stateResponse, instancesResponse] = await Promise.all([
      fetch(
        `${config.EVOLUTION_API_URL}/instance/connectionState/${config.EVOLUTION_INSTANCE}`,
        { headers },
      ),
      fetch(
        `${config.EVOLUTION_API_URL}/instance/fetchInstances?instanceName=${encodeURIComponent(config.EVOLUTION_INSTANCE)}`,
        { headers },
      ),
    ]);
    const state: any = await stateResponse.json();
    let managerUrl = `${config.EVOLUTION_API_URL}/manager`;
    if (instancesResponse.ok) {
      const instances: any = await instancesResponse.json();
      const instance = (
        Array.isArray(instances) ? instances : instances?.value
      )?.find((item: any) => item.name === config.EVOLUTION_INSTANCE);
      if (instance?.id)
        managerUrl = `${config.EVOLUTION_API_URL}/manager/instance/${instance.id}/dashboard`;
    }
    res.status(stateResponse.ok ? 200 : 502).json({ ...state, managerUrl });
  } catch {
    res.status(502).json({
      instance: { state: "offline" },
      managerUrl: `${config.EVOLUTION_API_URL}/manager`,
    });
  }
});
routes.post("/connection/qr", adminOnly, async (_req, res) => {
  try {
    const headers = { apikey: config.EVOLUTION_API_KEY };
    const stateResponse = await fetch(
      `${config.EVOLUTION_API_URL}/instance/connectionState/${config.EVOLUTION_INSTANCE}`,
      { headers },
    );
    const state: any = await stateResponse.json();
    if (state?.instance?.state === "open")
      return res.json({ connected: true, state: "open" });
    const qrResponse = await fetch(
      `${config.EVOLUTION_API_URL}/instance/connect/${config.EVOLUTION_INSTANCE}`,
      { headers },
    );
    const qr: any = await qrResponse.json();
    if (!qrResponse.ok || !qr?.base64)
      return res
        .status(502)
        .json({ error: "Não foi possível gerar o QR Code" });
    res.json({ connected: false, state: "connecting", qrCode: qr.base64 });
  } catch {
    res.status(502).json({ error: "Evolution API indisponível" });
  }
});
routes.delete("/connection", adminOnly, async (req: Authed, res) => {
  try {
    const response = await fetch(
      `${config.EVOLUTION_API_URL}/instance/logout/${config.EVOLUTION_INSTANCE}`,
      {
        method: "DELETE",
        headers: { apikey: config.EVOLUTION_API_KEY },
      },
    );
    const result: any = await response.json().catch(() => ({}));
    if (!response.ok)
      return res
        .status(502)
        .json({ error: result?.response?.message || "Falha ao desconectar" });
    await audit(
      req,
      "disconnect_whatsapp",
      "instance",
      config.EVOLUTION_INSTANCE,
    );
    res.json({ disconnected: true, state: "offline" });
  } catch {
    res.status(502).json({ error: "Evolution API indisponível" });
  }
});
routes.get("/users", adminOnly, async (_req, res) =>
  res.json(
    (
      await query(
        `SELECT id,name,email,role,active,must_change_password,last_login_at,last_seen_at,created_at FROM users ORDER BY name`,
      )
    ).rows,
  ),
);
routes.post("/users", adminOnly, async (req: Authed, res) => {
  const b = z
    .object({
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(8),
      role: z.enum(["admin", "agent"]),
    })
    .parse(req.body);
  const u = (
    await query(
      `INSERT INTO users(name,email,password_hash,role,must_change_password) VALUES($1,$2,$3,$4,true) RETURNING id,name,email,role,active,must_change_password`,
      [b.name, b.email, await hashPassword(b.password), b.role],
    )
  ).rows[0];
  await audit(req, "create_user", "user", (u as any).id);
  res.status(201).json(u);
});
routes.get("/auth/me", async (req: Authed, res) => {
  const user = (
    await query(
      `SELECT id,name,email,role,active,must_change_password,last_login_at,last_seen_at FROM users WHERE id=$1`,
      [req.user.sub],
    )
  ).rows[0];
  res.json(user);
});
routes.post("/auth/change-password", async (req: Authed, res) => {
  const parsed = z
    .object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    })
    .safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: "Preencha a senha atual e use uma nova senha com pelo menos 8 caracteres.",
    });
  const body = parsed.data;
  if (body.currentPassword === body.newPassword)
    return res.status(400).json({
      error: "A nova senha precisa ser diferente da senha temporária.",
    });
  const user: any = (
    await query(`SELECT * FROM users WHERE id=$1`, [req.user.sub])
  ).rows[0];
  if (
    !user ||
    !(await verifyPassword(body.currentPassword, user.password_hash))
  )
    return res.status(400).json({
      error: "A senha atual está incorreta. Digite exatamente a senha temporária recebida.",
    });
  await query(
    `UPDATE users SET password_hash=$2,must_change_password=false,failed_attempts=0,locked_until=NULL WHERE id=$1`,
    [user.id, await hashPassword(body.newPassword)],
  );
  await audit(req, "change_password", "user", user.id);
  res.json({ ok: true });
});
routes.post(
  "/users/:id/reset-password",
  adminOnly,
  async (req: Authed, res) => {
    const password = temporaryPassword();
    const user: any = (
      await query(
        `UPDATE users SET password_hash=$2,must_change_password=true,failed_attempts=0,locked_until=NULL WHERE id=$1 RETURNING id,name,email`,
        [req.params.id, await hashPassword(password)],
      )
    ).rows[0];
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    await audit(req, "reset_password", "user", user.id);
    res.json({ user, password });
  },
);
routes.patch("/users/:id", adminOnly, async (req: Authed, res) => {
  const parsed = z
    .object({
      active: z.boolean().optional(),
      role: z.enum(["admin", "agent"]).optional(),
      name: z.string().min(2).optional(),
      email: z.string().email().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Confira o nome, e-mail e perfil." });
  const body = parsed.data;
  try {
    const user = (
      await query(
        `UPDATE users SET active=COALESCE($2,active),role=COALESCE($3,role),name=COALESCE($4,name),email=COALESCE($5,email) WHERE id=$1 RETURNING id,name,email,role,active,must_change_password,last_login_at,last_seen_at`,
        [
          req.params.id,
          body.active ?? null,
          body.role ?? null,
          body.name ?? null,
          body.email ?? null,
        ],
      )
    ).rows[0];
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    await audit(req, "update_user", "user", String(req.params.id), body);
    res.json(user);
  } catch (error: any) {
    if (error?.code === "23505")
      return res.status(409).json({ error: "Este e-mail já está em uso." });
    throw error;
  }
});
routes.delete("/users/:id", adminOnly, async (req: Authed, res) => {
  const user: any = (
    await query(`SELECT id,name,role FROM users WHERE id=$1`, [req.params.id])
  ).rows[0];
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
  if (String(req.user?.sub) === String(user.id))
    return res.status(400).json({
      error: "Você não pode excluir o usuário que está conectado.",
    });
  if (user.role === "admin") {
    const admins = (
      await query<{ count: number }>(
        `SELECT count(*)::int count FROM users WHERE role='admin'`,
      )
    ).rows[0]?.count;
    if (admins <= 1)
      return res.status(400).json({
        error: "Não é possível excluir o último administrador.",
      });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE audit_logs SET user_id=NULL WHERE user_id=$1`, [
      user.id,
    ]);
    await client.query(
      `UPDATE conversation_notes SET user_id=NULL WHERE user_id=$1`,
      [user.id],
    );
    await client.query(
      `UPDATE messages SET agent_user_id=NULL WHERE agent_user_id=$1`,
      [user.id],
    );
    await client.query(`DELETE FROM users WHERE id=$1`, [user.id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  await audit(req, "delete_user", "user", String(user.id), {
    name: user.name,
  });
  res.status(204).end();
});
routes.get("/audit", adminOnly, async (_req, res) =>
  res.json(
    (
      await query(
        `SELECT a.*,u.name user_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 200`,
      )
    ).rows,
  ),
);
for (const resource of ["triggers", "tags"])
  routes.delete(`/${resource}/:id`, adminOnly, async (req: Authed, res) => {
    await query(`DELETE FROM ${resource} WHERE id=$1`, [req.params.id]);
    await audit(req, "delete", resource, String(req.params.id));
    res.status(204).end();
  });

routes.get("/system/diagnostics", adminOnly, async (_req, res) => {
  const started = Date.now();
  const checks: any = {
    api: { ok: true, uptimeSeconds: Math.round(process.uptime()) },
  };
  try {
    await query("SELECT 1");
    checks.database = {
      ok: true,
      latencyMs: Date.now() - started,
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
    };
  } catch (e: any) {
    checks.database = { ok: false, error: e.message };
  }
  try {
    const t = Date.now();
    const response = await fetch(
      `${config.EVOLUTION_API_URL}/instance/connectionState/${config.EVOLUTION_INSTANCE}`,
      { headers: { apikey: config.EVOLUTION_API_KEY } },
    );
    const data: any = await response.json();
    checks.whatsapp = {
      ok: response.ok,
      state: data?.instance?.state || "unknown",
      latencyMs: Date.now() - t,
    };
  } catch (e: any) {
    checks.whatsapp = { ok: false, state: "offline", error: e.message };
  }
  const queue = (
    await query(
      `SELECT count(*) FILTER(WHERE status='pending')::int pending,count(*) FILTER(WHERE status='failed')::int failed FROM outbound_queue`,
    )
  ).rows[0];
  const lastMessage =
    (
      await query(
        `SELECT created_at,direction,status FROM messages ORDER BY created_at DESC LIMIT 1`,
      )
    ).rows[0] || null;
  const errors = (
    await query(
      `SELECT * FROM system_logs WHERE level IN ('warn','error') ORDER BY created_at DESC LIMIT 20`,
    )
  ).rows;
  checks.queue = queue;
  checks.lastMessage = lastMessage;
  checks.generatedAt = new Date().toISOString();
  res.json({ checks, errors });
});
routes.get("/system/export", adminOnly, async (req: Authed, res) => {
  const tables = [
    "settings",
    "triggers",
    "menu_items",
    "tags",
    "customers",
    "customer_tags",
    "conversations",
    "messages",
  ];
  const data: any = {
    version: 1,
    createdAt: new Date().toISOString(),
    tables: {},
  };
  for (const table of tables)
    data.tables[table] = (await query(`SELECT * FROM ${table}`)).rows;
  await audit(req, "export_data", "system");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=atendeflow-${new Date().toISOString().slice(0, 10)}.json`,
  );
  res.json(data);
});
routes.get("/system/logs", adminOnly, async (_req, res) =>
  res.json(
    (
      await query(
        `SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 200`,
      )
    ).rows,
  ),
);
routes.get("/reports/overview", adminOnly, async (_req, res) => {
  const daily = (
    await query(
      `SELECT date_trunc('day',created_at)::date AS report_day,count(*) FILTER(WHERE direction='in')::int received,count(*) FILTER(WHERE direction='out')::int sent,count(*) FILTER(WHERE sender='bot')::int automated,count(*) FILTER(WHERE sender='agent')::int human FROM messages WHERE created_at>=now()-interval '30 days' GROUP BY 1 ORDER BY 1`,
    )
  ).rows;
  const summary = (
    await query(
      `SELECT
        (SELECT count(*)::int FROM customers) customers,
        count(*) FILTER(WHERE sender='bot' AND created_at>=now()-interval '30 days')::int automated,
        count(*) FILTER(WHERE direction='in' AND created_at>=now()-interval '30 days')::int received,
        LEAST(100,COALESCE(round(100.0*count(*) FILTER(WHERE sender='bot' AND created_at>=now()-interval '30 days')/NULLIF(count(*) FILTER(WHERE direction='in' AND created_at>=now()-interval '30 days'),0)),0))::int automation_rate
       FROM messages`,
    )
  ).rows[0];
  const waiting = (
    await query(
      `SELECT count(*)::int waiting FROM conversations c JOIN customers cu ON cu.id=c.customer_id WHERE c.status IN ('waiting','human') AND cu.automation_paused=true AND (cu.automation_paused_until IS NULL OR cu.automation_paused_until>now())`,
    )
  ).rows[0]?.waiting;
  res.json({ daily, summary: { ...summary, waiting } });
});
