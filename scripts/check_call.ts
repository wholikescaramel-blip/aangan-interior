/** Shows what happened to one call: npm-less helper, `npx tsx --env-file=.env scripts/check_call.ts <call id>` */
import { sql } from "../lib/db";
(async () => {
  const id = process.argv[2];
  const c = (await sql()`SELECT processing_status, caller_number_e164, response_time_seconds, duration_seconds, after_hours, left(transcript, 80) AS t FROM calls WHERE id = ${id}`) as any[];
  const q = (await sql()`SELECT status, model, reasons FROM qualifications WHERE call_id = ${id}`) as any[];
  const h = (await sql()`SELECT telegram_chat_id, telegram_message_id FROM handoffs WHERE call_id = ${id}`) as any[];
  const e = await sql()`SELECT stage, message FROM errors WHERE call_id = ${id}`;
  console.log(JSON.stringify({ call: c[0], qualification: q[0], handoff: h[0], errors: e }, null, 1));
})();
