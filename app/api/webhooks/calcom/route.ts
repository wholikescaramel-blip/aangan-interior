import { matchBooking, parseCalcom, verifyCalcom, type DealMatch } from "@/lib/calcom";
import { sql, logError } from "@/lib/db";
import { HubSpot } from "@/lib/hubspot";
import { esc, formatIST, leadChatId, postNote } from "@/lib/telegram";
import { isDryRun } from "@/lib/env";

export const maxDuration = 30;

type MatchRow = Omit<DealMatch, "matchedBy">;

// Most recent open lead for this phone / contact. In DRY_RUN no HubSpot deals exist, so a lead
// without a deal can still be matched for testing.
const LEAD_SELECT = `
  SELECT c.id AS "callId", h.deal_id AS "dealId", h.contact_id AS "contactId", ho.claimed_by AS "claimedBy"
  FROM calls c
  JOIN qualifications q ON q.call_id = c.id AND q.status IN ('qualified', 'needs_review')
  LEFT JOIN hubspot_sync h ON h.call_id = c.id
  LEFT JOIN handoffs ho ON ho.call_id = c.id
  WHERE %WHERE%
    AND (h.deal_id IS NOT NULL OR $2::boolean)
    AND COALESCE(h.deal_is_closed, false) = false
  ORDER BY c.received_at DESC
  LIMIT 1`;
const leadSql = (where: "phone" | "contact", value: string) =>
  sql().query(
    LEAD_SELECT.replace(
      "%WHERE%",
      where === "phone" ? "(c.caller_number_e164 = $1 OR q.collected->>'phone' = $1)" : "h.contact_id = $1",
    ),
    [value, isDryRun()],
  );

export async function POST(req: Request) {
  const rawBody = await req.text();
  if (!verifyCalcom(rawBody, req.headers.get("x-cal-signature-256"))) return new Response("unauthorized", { status: 401 });

  const b = parseCalcom(JSON.parse(rawBody));
  if (b.event === "other" || !b.uid) return Response.json({ ok: true, ignored: true });
  const who = esc(b.name ?? b.email ?? "A client");
  const when = b.start ? formatIST(b.start) : "a time to be confirmed";

  if (b.event === "canceled") {
    await sql()`UPDATE bookings SET status = 'canceled', canceled_at = now() WHERE booking_uid = ${b.uid}`;
    await postNote(`❌ ${who} cancelled their consultation (${when}).`);
    return Response.json({ ok: true });
  }

  // created / rescheduled: store once per booking uid.
  const inserted = (await sql()`
    INSERT INTO bookings (booking_uid, event_title, invitee_name, invitee_email, invitee_phone_e164, booked_at, event_start_at, raw)
    VALUES (${b.uid}, ${b.title}, ${b.name}, ${b.email}, ${b.phoneE164}, now(), ${b.start}, ${rawBody})
    ON CONFLICT (booking_uid) DO NOTHING
    RETURNING id`) as { id: string }[];
  if (!inserted[0]) return Response.json({ ok: true, duplicate: true });

  const hubspot = new HubSpot();
  const match = await matchBooking(b, {
    byPhone: async (p) => ((await leadSql("phone", p)) as MatchRow[])[0] ?? null,
    contactIdByEmail: (email) => hubspot.findContactByEmail(email),
    byContactId: async (id) => ((await leadSql("contact", id)) as MatchRow[])[0] ?? null,
  });

  if (!match) {
    await logError("calcom", "Booking could not be matched to a lead", { uid: b.uid, name: b.name, email: b.email, phone: b.phoneE164 });
    const admin = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (admin) await postNote(`⚠️ Unmatched booking: ${who} for ${when} (${esc(b.email ?? "no email")}, ${esc(b.phoneE164 ?? "no phone")}). Please link it in HubSpot.`, admin);
    return Response.json({ ok: true, matched: false });
  }

  await sql()`UPDATE bookings SET call_id = ${match.callId}, deal_id = ${match.dealId}, matched_by = ${match.matchedBy} WHERE id = ${inserted[0].id}`;
  try {
    const stage = process.env.HUBSPOT_STAGE_CONSULT_BOOKED;
    if (match.dealId && stage) {
      await hubspot.updateDeal(match.dealId, { dealstage: stage });
      await sql()`UPDATE hubspot_sync SET deal_stage = ${stage}, updated_at = now() WHERE call_id = ${match.callId}`;
    }
    if (b.start)
      await hubspot.logMeeting({
        contactId: match.contactId, dealId: match.dealId, title: b.title ?? "Design consultation",
        start: b.start, end: b.end, body: `Booked via Cal.com by ${b.name ?? b.email ?? "client"} (matched by ${match.matchedBy}).`,
      });
  } catch (err) {
    await logError("hubspot", `booking sync failed: ${String((err as Error).message ?? err)}`, { uid: b.uid }, match.callId);
  }

  const verb = b.event === "rescheduled" ? "rescheduled their consultation to" : "booked a consultation for";
  await postNote(`📅 ${who} ${verb} ${when}${match.claimedBy ? ` (lead taken by ${esc(match.claimedBy)})` : ""}.`, leadChatId());
  return Response.json({ ok: true, matched: true });
}
