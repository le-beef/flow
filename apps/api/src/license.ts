import crypto from "node:crypto";
import { Router } from "express";
import { query } from "./db.js";
import type { Request, Response, NextFunction } from "express";
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAfP7ZEvi+uQ9+9EWpBgMvkkG034iegsLsZEkZ3HNCkok=
-----END PUBLIC KEY-----`;
type License = {
  id: string;
  product: string;
  customer: string;
  installationId: string;
  issuedAt: string;
  expiresAt: string;
};
const decode = (s: string) => Buffer.from(s, "base64url");
export function verifyLicense(key: string): License {
  const parts = key.trim().split(".");
  if (parts.length !== 2) throw new Error("Formato de licença inválido");
  if (
    decode(parts[0]).toString("base64url") !== parts[0] ||
    decode(parts[1]).toString("base64url") !== parts[1]
  )
    throw new Error("Codificação da licença inválida");
  if (!crypto.verify(null, Buffer.from(parts[0]), PUBLIC_KEY, decode(parts[1])))
    throw new Error("Assinatura da licença inválida");
  const payload = JSON.parse(decode(parts[0]).toString()) as License;
  if (payload.product !== "lebeef-whatsapp")
    throw new Error("Licença destinada a outro produto");
  if (!payload.id || !payload.installationId || !payload.expiresAt)
    throw new Error("Licença incompleta");
  return payload;
}
async function installationId() {
  return String(
    (await query<any>(`SELECT value FROM settings WHERE key='installation_id'`))
      .rows[0]?.value || "",
  );
}
export async function getLicenseStatus() {
  const installation = await installationId();
  const row = (
    await query<any>("SELECT * FROM license_activation WHERE id=true")
  ).rows[0];
  if (!row) {
    const created = String(
      (
        await query<any>(
          `SELECT value FROM settings WHERE key='installation_created_at'`,
        )
      ).rows[0]?.value || new Date().toISOString(),
    );
    const expiresAt = new Date(new Date(created).getTime() + 7 * 86400000);
    const active = expiresAt.getTime() > Date.now();
    return {
      active,
      reason: active ? "trial" : "trial_expired",
      installationId: installation,
      customer: "Período de avaliação",
      expiresAt: expiresAt.toISOString(),
      trial: true,
    };
  }
  const expired = new Date(row.expires_at).getTime() <= Date.now();
  return {
    active: !expired,
    reason: expired ? "expired" : "active",
    installationId: installation,
    customer: row.customer,
    expiresAt: row.expires_at,
    licenseId: row.license_id,
  };
}
export const licenseRoutes = Router();
licenseRoutes.get("/status", async (_req, res) =>
  res.json(await getLicenseStatus()),
);
licenseRoutes.post("/activate", async (req, res) => {
  try {
    const key = String(req.body?.key || "");
    const data = verifyLicense(key);
    const installation = await installationId();
    if (data.installationId !== installation)
      return res
        .status(400)
        .json({ error: "Esta chave pertence a outra instalação" });
    if (new Date(data.expiresAt).getTime() <= Date.now())
      return res.status(400).json({ error: "Esta chave está vencida" });
    await query(
      `INSERT INTO license_activation(id,license_id,license_key,customer,installation_id,issued_at,expires_at) VALUES(true,$1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET license_id=EXCLUDED.license_id,license_key=EXCLUDED.license_key,customer=EXCLUDED.customer,installation_id=EXCLUDED.installation_id,issued_at=EXCLUDED.issued_at,expires_at=EXCLUDED.expires_at,activated_at=now()`,
      [
        data.id,
        key,
        data.customer,
        data.installationId,
        data.issuedAt,
        data.expiresAt,
      ],
    );
    res.json(await getLicenseStatus());
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
export async function licenseGuard(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  const status = await getLicenseStatus();
  return status.active
    ? next()
    : res
        .status(402)
        .json({ error: "Licença não ativada ou vencida", license: status });
}
