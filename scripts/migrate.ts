/** Applies migrations/*.sql in order, once each. Usage: npm run migrate */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const sql = neon(process.env.DATABASE_URL);
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  const applied = new Set((await sql`SELECT name FROM schema_migrations`).map((r) => r.name as string));
  const dir = path.join(process.cwd(), "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (applied.has(file)) continue;
    const statements = readFileSync(path.join(dir, file), "utf8")
      .split(/;\s*$/m)
      .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
      .filter(Boolean);
    await sql.transaction([
      ...statements.map((s) => sql.query(s)),
      sql`INSERT INTO schema_migrations (name) VALUES (${file})`,
    ]);
    console.log("applied", file);
  }
  console.log("migrations up to date");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
