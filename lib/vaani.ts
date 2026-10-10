/**
 * Vaani end-of-call webhook adapter.
 *
 * INTERIM: Vaani's payload documentation was not available when this was written, so fields are
 * read from a list of likely names and the raw payload is always stored. Once a real payload
 * arrives (see README "Connect Vaani"), replace the candidate lists with the exact paths and
 * delete the ones that don't apply.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import type { Enquiry } from "./enquiry";
import { toE164 } from "./phone";

type Obj = Record<string, unknown>;

const PATHS = {
  callId: ["call_id", "callId", "id", "call.id", "data.call_id", "data.id", "session_id", "conversation_id"],
  caller: ["from", "from_number", "fromNumber", "caller", "caller_number", "caller_id", "customer_number",
    "customer.number", "phone_number", "call.from", "data.from", "data.caller_number"],
  startedAt: ["start_time", "started_at", "startedAt", "call_start", "ring_time", "created_at", "call.started_at", "data.started_at"],
  answeredAt: ["answered_at", "answer_time", "answeredAt", "call.answered_at", "data.answered_at"],
  endedAt: ["end_time", "ended_at", "endedAt", "call_end", "call.ended_at", "data.ended_at"],
  duration: ["duration", "duration_seconds", "call_duration", "durationSeconds", "call.duration", "data.duration"],
  transcript: ["transcript", "transcription", "conversation", "messages", "call.transcript", "data.transcript"],
  recording: ["recording_url", "recordingUrl", "recording", "audio_url", "call.recording_url", "data.recording_url"],
  cost: ["cost", "call_cost", "total_cost", "cost_inr", "call.cost", "data.cost"],
  structured: ["extracted_data", "structured_data", "analysis", "variables", "collected_data", "data.analysis"],
  event: ["event", "type", "event_type", "status", "call_status"],
};

function get(o: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((cur, k) => (cur && typeof cur === "object" ? (cur as Obj)[k] : undefined), o);
}
function pick(o: unknown, paths: string[]): unknown {
  for (const p of paths) {
    const v = get(o, p);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}
function toDate(v: unknown): Date | null {
  if (v === undefined || v === null || v === "") return null;
  const d = typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v) : new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}
function toNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && String(v ?? "") !== "" ? n : null;
}

/** Turns a string or an array of {role, content|text|message} turns into "Agent: …\nCaller: …". */
export function transcriptToText(t: unknown): string | null {
  if (!t) return null;
  if (typeof t === "string") return t.trim() || null;
  if (!Array.isArray(t)) return JSON.stringify(t);
  const lines = t.map((turn) => {
    if (typeof turn === "string") return turn;
    const o = turn as Obj;
    const role = String(o.role ?? o.speaker ?? o.from ?? "").toLowerCase();
    const who = /assistant|agent|bot|ai|model/.test(role) ? "Agent" : /user|caller|customer|human/.test(role) ? "Caller" : role || "?";
    const text = o.content ?? o.text ?? o.message ?? o.transcript ?? "";
    return `${who}: ${typeof text === "string" ? text : JSON.stringify(text)}`;
  });
  return lines.join("\n").trim() || null;
}

export function parseVaaniPayload(raw: unknown, rawBody: string): Enquiry {
  const transcript = transcriptToText(pick(raw, PATHS.transcript));
  const event = String(pick(raw, PATHS.event) ?? "").toLowerCase();
  const startedAt = toDate(pick(raw, PATHS.startedAt));
  const endedAt = toDate(pick(raw, PATHS.endedAt));
  let duration = toNum(pick(raw, PATHS.duration));
  if (duration !== null && duration > 36000) duration = Math.round(duration / 1000); // ms -> s
  if (duration === null && startedAt && endedAt) duration = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);
  const structured = pick(raw, PATHS.structured);
  const id = pick(raw, PATHS.callId);
  return {
    channel: "phone",
    // Fallback idempotency key: hash of the body, so identical retries still dedupe.
    externalId: id !== undefined ? String(id) : "sha256:" + createHash("sha256").update(rawBody).digest("hex"),
    callerNumberE164: toE164(pick(raw, PATHS.caller) as string | undefined),
    startedAt,
    answeredAt: toDate(pick(raw, PATHS.answeredAt)),
    endedAt,
    durationSeconds: duration,
    transcript,
    recordingUrl: (pick(raw, PATHS.recording) as string | undefined) ?? null,
    structured: structured && typeof structured === "object" ? (structured as Obj) : null,
    providerCostInr: toNum(pick(raw, PATHS.cost)),
    // A call-started / ringing event has no transcript; a finished call has one.
    isComplete: !!transcript && !/start|ring|initiat|progress/.test(event),
    raw,
  };
}

/**
 * Vaani transcript text ("[13:33:14] AGENT: Hi…\n\n[13:33:20] USER: Hello…") -> "Agent: …\nCaller: …".
 * Docs: https://docs.vaanivoice.ai/guides/webhook-setup.md
 */
export function vaaniTranscript(t: unknown): string | null {
  if (typeof t !== "string") return transcriptToText(t);
  const turns: string[] = [];
  for (const raw of t.split(/\n+/)) {
    const line = raw.trim().replace(/^\[\d{1,2}:\d{2}(:\d{2})?\]\s*/, "");
    if (!line) continue;
    const m = line.match(/^(AGENT|ASSISTANT|BOT|USER|CUSTOMER|CALLER)\s*:\s*(.*)$/i);
    if (m) turns.push(`${/agent|assistant|bot/i.test(m[1]) ? "Agent" : "Caller"}: ${m[2]}`);
    else if (turns.length) turns[turns.length - 1] += " " + line;
    else turns.push(line);
  }
  return turns.join("\n") || null;
}

export interface VaaniRoom {
  phone_number: string | null;
  started_at: string | null;
  picked_up_at: string | null;
  ended_at: string | null;
}

/** Builds the enquiry from Vaani's documented call_postprocessing event, joined with the room's earlier events. */
export function parseVaaniPostprocessing(body: any, room: VaaniRoom | null): Enquiry {
  const d = body?.data ?? body ?? {};
  // Docs say milliseconds; real payloads send seconds (e.g. 118.68). Large values are treated as ms.
  const dur = typeof d.call_duration === "number" ? d.call_duration : null;
  const durationS = dur == null ? null : Math.round(dur > 20000 ? dur / 1000 : dur);
  const endedAt = toDate(d.call_ended_at) ?? toDate(room?.ended_at) ?? toDate(body?.timestamp) ?? new Date();
  const startedAt =
    toDate(d.call_started_at) ?? toDate(d.call_dialing_at) ?? toDate(room?.started_at) ??
    (durationS != null ? new Date(endedAt.getTime() - durationS * 1000) : null);
  return {
    channel: "phone",
    externalId: String(body?.call_id ?? d.call_id ?? d.room_name),
    callerNumberE164: toE164(d.phone_number ?? room?.phone_number ?? body?.from ?? d.from ?? null),
    startedAt,
    answeredAt: toDate(d.picked_up_at) ?? toDate(room?.picked_up_at),
    endedAt,
    durationSeconds: durationS,
    transcript: vaaniTranscript(d.transcript ?? d.transcription),
    recordingUrl: d.recording_url ?? null,
    structured: { summary: d.summary ?? null, entities: d.entities ?? null, dispositions: d.dispositions ?? null, end_reason: d.end_reason ?? null },
    providerCostInr: toNum(d.cost ?? body?.cost),
    isComplete: true,
    raw: body,
  };
}

/**
 * INTERIM auth until Vaani's signing scheme is known: the shared secret VAANI_WEBHOOK_SECRET must be
 * sent as ?token=…, an "x-webhook-secret"/"x-vaani-secret" header, or "Authorization: Bearer …".
 */
export function verifyVaani(req: Request, secret = process.env.VAANI_WEBHOOK_SECRET): boolean {
  if (!secret) return false;
  const url = new URL(req.url);
  const auth = req.headers.get("authorization");
  const candidates = [
    url.searchParams.get("token"),
    req.headers.get("x-webhook-secret"),
    req.headers.get("x-vaani-secret"),
    auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null,
  ];
  return candidates.some((c) => c !== null && safeEqual(c, secret));
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
