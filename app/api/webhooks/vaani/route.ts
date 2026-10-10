import { after } from "next/server";
import { parseVaaniPayload, verifyVaani } from "@/lib/vaani";
import { processCall, storeEnquiry } from "@/lib/pipeline";
import { logError } from "@/lib/db";

export const maxDuration = 60;

/** Vaani end-of-call webhook: verify, store once, answer 200 fast, then qualify/sync/post in after(). */
export async function POST(req: Request) {
  if (!verifyVaani(req)) return Response.json({ error: "unauthorized" }, { status: 401 });

  const rawBody = await req.text();
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    await logError("webhook", "Vaani payload is not JSON", { rawBody: rawBody.slice(0, 5000) });
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const enquiry = parseVaaniPayload(body, rawBody);
  const callId = await storeEnquiry(enquiry);
  if (!callId) return Response.json({ ok: true, duplicate: true });
  if (!enquiry.transcript)
    await logError("webhook", "Vaani payload had no transcript (field mapping may need updating)", { keys: Object.keys(body as object) }, callId);

  if (enquiry.isComplete) after(() => processCall(callId));
  return Response.json({ ok: true, call_id: callId });
}
