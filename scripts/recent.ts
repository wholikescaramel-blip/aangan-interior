/** Lists the latest calls, Vaani room events and errors: npx tsx --env-file=.env scripts/recent.ts */
import { sql } from "../lib/db";
(async () => {
  console.log("CALLS", JSON.stringify(await sql()`SELECT c.id, c.external_id, c.received_at, c.processing_status, c.caller_number_e164, q.status, left(c.transcript, 60) AS t FROM calls c LEFT JOIN qualifications q ON q.call_id = c.id ORDER BY c.received_at DESC LIMIT 5`, null, 1));
  console.log("ROOMS", JSON.stringify(await sql()`SELECT * FROM vaani_rooms ORDER BY updated_at DESC LIMIT 5`, null, 1));
  console.log("ERRORS", JSON.stringify(await sql()`SELECT stage, message, created_at FROM errors ORDER BY created_at DESC LIMIT 5`, null, 1));
})();
