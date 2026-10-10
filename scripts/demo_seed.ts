/**
 * Demo data for looking at the dashboard before real calls exist.
 *   npm run demo            # add 10 demo calls (external_id starts with "demo-")
 *   npm run demo -- remove  # delete them again
 */
import { sql } from "../lib/db";

const people = [
  ["Priya Joshi", "Kothrud", "home", "full home", 1400, "qualified", "by March", 2, 0.4, true, false, 0],
  ["Rahul Joshi", "Wakad", "home", "full home", 950, "qualified", "by February", 3, 3, true, false, 0],
  ["Kunal Mehta", "Baner", "office", "office fit-out", 800, "qualified", "end of January", 2, 0.9, true, true, 1800000],
  ["Smita Rao", "Undri", "home", "kitchen, wardrobes, living", 875, "needs_review", "around April", 4, 30, false, false, 0],
  ["Suresh Patil", "Nashik", "home", "home office", null, "not_qualified", null, 2, null, false, false, 0],
  ["(vendor)", null, null, null, null, "not_a_lead", null, 1, null, false, false, 0],
  ["Rohan Gokhale", "Hadapsar", "home", "full home", 1100, "qualified", "by April", 2, 26, false, false, 0],
  ["Pooja Iyer", "Magarpatta", "home", "full home", 900, "qualified", "flexible", 3, null, false, false, 0],
  ["Meera Kulkarni", "Kothrud", "home", "living room + kitchen", 900, "needs_review", "end of February", 2, 0.7, false, false, 0],
  ["Sheetal Deshpande", "Viman Nagar", null, null, null, "not_a_lead", null, 2, null, false, false, 0],
] as const;

async function main() {
  if (process.argv[2] === "remove") {
    const r = (await sql()`DELETE FROM calls WHERE external_id LIKE 'demo-%' RETURNING id`) as unknown[];
    console.log(`removed ${r.length} demo calls`);
    return;
  }
  const now = Date.now();
  for (const [i, p] of people.entries()) {
    const [name, area, type, scope, sqft, status, timeline, respS, claimH, booked, won, amount] = p;
    const at = new Date(now - (i * 26 + 3) * 3600000);
    const ist = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(at));
    const transcript = `Agent: Namaste, thank you for calling Aangan Studio! I'm Aangan's virtual assistant, an AI. This call is recorded so our designers can help you better. Are you planning a home or an office interior?
Caller: ${type === "office" ? "Office, we just got a space" : "Home"}${area ? ` in ${area}` : ""}.
Agent: Lovely. What would you like done: the full home, or specific rooms?
Caller: ${scope ?? "Actually I'm calling about something else."}
Agent: Got it. When would you need the project complete?
Caller: ${timeline ?? "Not sure."}
Agent: Thank you. A designer from our team will call you back within an hour. Thank you for calling Aangan Studio. Have a lovely day!`;
    const [row] = (await sql()`
      INSERT INTO calls (channel, external_id, caller_number_e164, started_at, answered_at, ended_at, duration_seconds,
                         response_time_seconds, after_hours, transcript, raw_payload, processing_status, provider_cost_inr)
      VALUES ('phone', ${"demo-" + i}, ${"+9198765000" + String(i).padStart(2, "0")}, ${at}, ${new Date(at.getTime() + respS * 1000)},
              ${new Date(at.getTime() + 200000)}, 200, ${respS}, ${ist < 10 || ist >= 19}, ${transcript}, '{"demo":true}', 'done', 9)
      ON CONFLICT (channel, external_id) DO NOTHING RETURNING id`) as { id: string }[];
    if (!row) continue;
    const collected = { name, phone: null, project_type: type, location: area, property_status: "ready", carpet_area_sqft: sqft, scope, budget: null, timeline, decision_maker: null, source: "Instagram", asked_about_pricing: i % 3 === 0 };
    await sql()`INSERT INTO qualifications (call_id, status, reasons, collected, missing_info, summary, suggested_next_step, model, input_tokens, output_tokens)
      VALUES (${row.id}, ${status}, ${JSON.stringify(["Demo data"])}, ${JSON.stringify(collected)}, '[]',
              ${`${scope ?? "Not a project enquiry"}${area ? ` in ${area}` : ""}. Demo record.`}, 'Call back and share the booking link.', 'demo', 4200, 380)`;
    if (status === "qualified" || status === "needs_review") {
      await sql()`INSERT INTO hubspot_sync (call_id, deal_id, deal_amount, deal_is_won, deal_is_closed) VALUES (${row.id}, ${"demo-deal-" + i}, ${amount || (sqft ? sqft * 1500 : null)}, ${won}, ${won})`;
      await sql()`INSERT INTO handoffs (call_id, telegram_chat_id, posted_at, claimed_by, claimed_at)
        VALUES (${row.id}, 'demo', ${new Date(at.getTime() + 60000)}, ${claimH == null ? null : ["Asha", "Rahul", "Meera"][i % 3]},
                ${claimH == null ? null : new Date(at.getTime() + 60000 + claimH * 3600000)})`;
      if (booked) await sql()`INSERT INTO bookings (booking_uid, call_id, invitee_name, booked_at, event_start_at) VALUES (${"demo-bk-" + i}, ${row.id}, ${name}, now(), ${new Date(now + 3 * 86400000)})`;
    }
  }
  console.log("demo calls added");
}
main().catch((e) => { console.error(e); process.exit(1); });
