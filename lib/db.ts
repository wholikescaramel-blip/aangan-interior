import { neon } from "@neondatabase/serverless";

let sqlFn: ReturnType<typeof neon> | null = null;

/** Tagged-template SQL client for Neon (HTTP, works on Vercel serverless). */
export function sql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  sqlFn ??= neon(process.env.DATABASE_URL);
  return sqlFn;
}

export async function logError(stage: string, message: string, detail?: unknown, callId?: string | null) {
  try {
    await sql()`INSERT INTO errors (call_id, stage, message, detail)
                VALUES (${callId ?? null}, ${stage}, ${message.slice(0, 2000)}, ${JSON.stringify(detail ?? null)})`;
  } catch (err) {
    console.error("logError failed", stage, message, err);
  }
}
