import dotenv from "dotenv";
import { z } from "zod";
dotenv.config({ path: new URL("../../../.env", import.meta.url) });
export const config = z
  .object({
    PORT: z.coerce.number().default(3333),
    DATABASE_URL: z.string().min(1),
    WEB_URL: z.string().default("http://localhost:5173"),
    EVOLUTION_API_URL: z.string().url(),
    EVOLUTION_API_KEY: z.string().min(1),
    EVOLUTION_INSTANCE: z.string().min(1),
    EVOLUTION_WEBHOOK_SECRET: z.string().min(1),
    JWT_SECRET: z.string().min(24),
    ADMIN_EMAIL: z.string().email().default("admin@lebeef.local"),
    ADMIN_PASSWORD: z.string().min(8),
    UPDATE_MANIFEST_URL: z.string().url().optional().or(z.literal("")),
  })
  .parse(process.env);
