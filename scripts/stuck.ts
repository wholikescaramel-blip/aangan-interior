import { sql } from "../lib/db";
(async () => { console.log(JSON.stringify(await sql()`SELECT id, processing_status, received_at, now() AS db_now FROM calls WHERE processing_status IN ('processing','received','failed') ORDER BY received_at DESC LIMIT 5`, null, 1)); })();
