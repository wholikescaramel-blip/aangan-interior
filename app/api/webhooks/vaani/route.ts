import { after } from "next/server";
import { parseVaaniPayload, parseVaaniPostprocessing, verifyVaani, type VaaniRoom } from "@/lib/vaani";
import { processCall, storeEnquiry } from "@/lib/pipeline";
import { logError, sql } from "@/lib/db";

export const maxDuration = 300;

/**
 * Vaani webhook (Settings -> Webhooks; one URL for all events).
 * Lifecycle events (call_started, user_picked_up_at, call_ended) are remembered per room; the final
 * call_postprocessing event becomes the enquiry: stored once, 200 returned fast, then qualify/sync/post.
 */
export async function POST(req: Request) {
  if (!verifyVaani(req)) return Response.json({ error: "unauthorized" }, { status: 401 });

  const rawBody = await req.text();
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    await logError("webhook", "Vaani payload is not JSON", { rawBody: rawBody.slice(0, 5000) });
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const event = String(body?.event ?? "");
  const room = body?.room_name ?? body?.data?.room_name ?? null;

  if (room && ["call_started", "user_picked_up_at", "call_ended"].includes(event)) {
    const now = new Date();
    await sql()`
      INSERT INTO vaani_rooms (room_name, phone_number, started_at, picked_up_at, ended_at, end_reason)
      VALUES (${room}, ${event === "call_started" ? body.phone_number ?? null : null},
              ${event === "call_started" ? now : null}, ${event === "user_picked_up_at" ? now : null},
              ${event === "call_ended" ? now : null}, ${body.end_reason ?? null})
      ON CONFLICT (room_name) DO UPDATE SET
        phone_number = COALESCE(vaani_rooms.phone_number, EXCLUDED.phone_number),
        started_at   = COALESCE(vaani_rooms.started_at, EXCLUDED.started_at),
        picked_up_at = COALESCE(vaani_rooms.picked_up_at, EXCLUDED.picked_up_at),
        ended_at     = COALESCE(vaani_rooms.ended_at, EXCLUDED.ended_at),
        end_reason   = COALESCE(EXCLUDED.end_reason, vaani_rooms.end_reason),
        updated_at   = now()`;
    return Response.json({ ok: true, event });
  }

  let enquiry;
  if (event === "call_postprocessing") {
    const r = room ? ((await sql()`SELECT phone_number, started_at, picked_up_at, ended_at FROM vaani_rooms WHERE room_name = ${room}`) as VaaniRoom[])[0] ?? null : null;
    enquiry = parseVaaniPostprocessing(body, r);
  } else if (event) {
    return Response.json({ ok: true, ignored: event }); // other lifecycle events
  } else {
    enquiry = parseVaaniPayload(body, rawBody); // unknown format: best-effort mapping
  }

  const callId = await storeEnquiry(enquiry);
  if (!callId) return Response.json({ ok: true, duplicate: true });
  if (!enquiry.transcript)
    await logError("webhook", "Vaani payload had no transcript", { keys: Object.keys(body ?? {}) }, callId);

  if (enquiry.isComplete && enquiry.transcript) after(() => processCall(callId));
  return Response.json({ ok: true, call_id: callId });
}
