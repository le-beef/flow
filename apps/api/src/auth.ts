import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { promisify } from "node:util";
import { query } from "./db.js";
import { config } from "./config.js";

const scrypt = promisify(crypto.scrypt);

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  try {
    const [salt, hex] = stored.split(":");
    const key = (await scrypt(password, salt, 64)) as Buffer;
    return crypto.timingSafeEqual(key, Buffer.from(hex, "hex"));
  } catch {
    return false;
  }
}

export function temporaryPassword() {
  return `AF-${crypto.randomBytes(5).toString("base64url")}!9`;
}

export async function ensureAdmin() {
  const found = await query("SELECT id FROM users LIMIT 1");
  if (!found.rowCount)
    await query(
      `INSERT INTO users(name,email,password_hash,role,must_change_password) VALUES('Administrador',$1,$2,'admin',true)`,
      [config.ADMIN_EMAIL, await hashPassword(config.ADMIN_PASSWORD)],
    );
}

export function sign(user: any) {
  return jwt.sign(
    { sub: user.id, name: user.name, email: user.email, role: user.role },
    config.JWT_SECRET,
    { expiresIn: "12h" },
  );
}

export type Authed = Request & { user?: any };
export function auth(req: Authed, res: Response, next: NextFunction) {
  const token = req.header("authorization")?.replace(/^Bearer /, "");
  if (!token) return res.status(401).json({ error: "Autenticação necessária" });
  try {
    req.user = jwt.verify(token, config.JWT_SECRET);
    query("UPDATE users SET last_seen_at=now() WHERE id=$1", [
      req.user.sub,
    ]).catch(() => {});
    next();
  } catch {
    return res.status(401).json({ error: "Sessão inválida ou expirada" });
  }
}

export const adminOnly = (req: Authed, res: Response, next: NextFunction) =>
  req.user?.role === "admin"
    ? next()
    : res.status(403).json({ error: "Acesso restrito ao administrador" });

export async function audit(
  req: Authed,
  action: string,
  entity?: string,
  entityId?: string,
  details?: any,
) {
  await query(
    `INSERT INTO audit_logs(user_id,action,entity,entity_id,details) VALUES($1,$2,$3,$4,$5)`,
    [
      req.user?.sub || null,
      action,
      entity || null,
      entityId || null,
      details ? JSON.stringify(details) : null,
    ],
  );
}

export async function systemLog(
  level: "info" | "warn" | "error",
  source: string,
  event: string,
  message: string,
  details?: any,
) {
  await query(
    `INSERT INTO system_logs(level,source,event,message,details) VALUES($1,$2,$3,$4,$5)`,
    [level, source, event, message, details ? JSON.stringify(details) : null],
  ).catch(() => {});
}
