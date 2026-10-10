/**
 * Channel-agnostic enquiry: every inbound channel (phone via Vaani today; WhatsApp / web form later)
 * is converted to this shape by its adapter, and everything downstream only sees this.
 */
export interface Enquiry {
  channel: "phone" | "whatsapp" | "web_form";
  externalId: string;
  callerNumberE164: string | null;
  startedAt: Date | null;
  answeredAt: Date | null;
  endedAt: Date | null;
  durationSeconds: number | null;
  transcript: string | null;
  recordingUrl: string | null;
  structured: Record<string, unknown> | null;
  providerCostInr: number | null;
  /** False for provider events that aren't a finished conversation (e.g. "call started"). */
  isComplete: boolean;
  raw: unknown;
}

/** Seconds from ring start to answer, if both are known and sane. */
export function responseTimeSeconds(e: Pick<Enquiry, "startedAt" | "answeredAt">): number | null {
  if (!e.startedAt || !e.answeredAt) return null;
  const s = (e.answeredAt.getTime() - e.startedAt.getTime()) / 1000;
  return s >= 0 && s < 3600 ? Math.round(s * 10) / 10 : null;
}
