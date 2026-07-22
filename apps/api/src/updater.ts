import crypto from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { config } from "./config.js";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
const versionFile = fileURLToPath(new URL("../../../VERSION", import.meta.url));
const updatesDir = fileURLToPath(new URL("../../../.updates/", import.meta.url));

export const updateManifestSchema = z.object({
  product: z.literal("AtendeFlow"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  publishedAt: z.string().datetime(),
  required: z.boolean().default(false),
  minimumVersion: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
  packageUrl: z.string().url(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  size: z.number().int().positive().max(250 * 1024 * 1024).optional(),
  notes: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
});

export type UpdateManifest = z.infer<typeof updateManifestSchema>;

export function compareVersions(left: string, right: string) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

export async function currentVersion() {
  return (await readFile(versionFile, "utf8")).trim();
}

export async function updateStatus() {
  const statusPath = fileURLToPath(new URL("../../../.updates/status.json", import.meta.url));
  try {
    return JSON.parse(await readFile(statusPath, "utf8"));
  } catch {
    return { state: "idle", message: "Nenhuma atualização em andamento.", progress: 0 };
  }
}

function assertRemoteUrl(raw: string) {
  const url = new URL(raw);
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !local)
    throw new Error("O servidor de atualização precisa usar HTTPS.");
  return url;
}

async function fetchWithTimeout(url: URL, timeout = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": `AtendeFlow/${await currentVersion()}` },
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function checkForUpdate() {
  const installedVersion = await currentVersion();
  if (!config.UPDATE_MANIFEST_URL)
    return {
      configured: false,
      installedVersion,
      available: false,
      message: "Servidor de atualizações ainda não configurado.",
    };
  const response = await fetchWithTimeout(assertRemoteUrl(config.UPDATE_MANIFEST_URL));
  if (!response.ok)
    throw new Error(`Servidor de atualização respondeu ${response.status}.`);
  const manifest = updateManifestSchema.parse(await response.json());
  const available = compareVersions(manifest.version, installedVersion) > 0;
  const compatible =
    !manifest.minimumVersion ||
    compareVersions(installedVersion, manifest.minimumVersion) >= 0;
  return { configured: true, installedVersion, available, compatible, manifest };
}

export async function downloadAvailableUpdate() {
  const result = await checkForUpdate();
  if (!result.configured || !result.manifest || !result.available)
    throw new Error("Nenhuma atualização nova está disponível.");
  if (!result.compatible)
    throw new Error("Esta versão exige o instalador completo do AtendeFlow.");
  const manifest = result.manifest;
  const response = await fetchWithTimeout(assertRemoteUrl(manifest.packageUrl), 120_000);
  if (!response.ok)
    throw new Error(`Não foi possível baixar o pacote (${response.status}).`);
  const length = Number(response.headers.get("content-length") || 0);
  if (length && length > 250 * 1024 * 1024)
    throw new Error("O pacote excede o limite de 250 MB.");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 250 * 1024 * 1024)
    throw new Error("O pacote excede o limite de 250 MB.");
  if (manifest.size && buffer.length !== manifest.size)
    throw new Error("O tamanho do pacote não corresponde ao manifesto.");
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  if (sha256.toLowerCase() !== manifest.sha256.toLowerCase())
    throw new Error("A assinatura SHA-256 do pacote é inválida.");
  await mkdir(updatesDir, { recursive: true });
  const target = fileURLToPath(
    new URL(`../../../.updates/AtendeFlow-${manifest.version}.zip`, import.meta.url),
  );
  const temporary = `${target}.download`;
  await writeFile(temporary, buffer);
  await rename(temporary, target);
  return { manifest, packagePath: target, sha256, size: buffer.length, projectRoot };
}

export async function preparedUpdate() {
  const result = await checkForUpdate();
  if (!result.configured || !result.manifest || !result.available)
    throw new Error("Nenhuma atualização nova está disponível.");
  if (!result.compatible)
    throw new Error("Esta versão exige o instalador completo do AtendeFlow.");
  const manifest = result.manifest;
  const packagePath = fileURLToPath(
    new URL(`../../../.updates/AtendeFlow-${manifest.version}.zip`, import.meta.url),
  );
  const file = await readFile(packagePath).catch(() => null);
  if (!file) throw new Error("Baixe o pacote antes de instalar.");
  const sha256 = crypto.createHash("sha256").update(file).digest("hex");
  if (sha256.toLowerCase() !== manifest.sha256.toLowerCase())
    throw new Error("O pacote preparado não passou na verificação SHA-256.");
  const details = await stat(packagePath);
  return { manifest, packagePath, sha256, size: details.size, projectRoot };
}
