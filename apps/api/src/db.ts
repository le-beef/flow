import pg from "pg";
import { config } from "./config.js";
export const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
export const query = <T extends pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
) => pool.query<T>(text, params);
export async function runMigrations() {
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until timestamptz;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS agent_user_id uuid REFERENCES users(id);
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS automation_paused_until timestamptz;
    CREATE TABLE IF NOT EXISTS system_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),level text NOT NULL DEFAULT 'info',source text NOT NULL,event text NOT NULL,message text NOT NULL,details jsonb,created_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS system_logs_created_idx ON system_logs(created_at DESC);
  `);
}
