import { sql } from "../lib/db";
(async () => { const r = (await sql()`SELECT transcript FROM calls WHERE id = ${process.argv[2]}`) as any[]; console.log(r[0]?.transcript); })();
