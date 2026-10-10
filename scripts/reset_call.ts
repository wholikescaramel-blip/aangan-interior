/** Marks a call as failed so it can be re-processed: npx tsx --env-file=.env scripts/reset_call.ts <id> */
import { sql } from "../lib/db";
(async () => { await sql()`UPDATE calls SET processing_status = 'failed' WHERE id = ${process.argv[2]}`; console.log("reset", process.argv[2]); })();
