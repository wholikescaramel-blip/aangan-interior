/**
 * Cal.com booking webhooks (free plan supports signed webhooks).
 * Signature: X-Cal-Signature-256 = hex HMAC-SHA256 of the raw body with the webhook secret.
 */
import { createHmac } from "node:crypto";
import { safeEqual } from "./vaani";
import { toE164 } from "./phone";

export function verifyCalcom(rawBody: string, signature: string | null, secret = process.env.CALCOM_WEBHOOK_SECRET): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(signature.trim().toLowerCase(), expected);
}

export interface Booking {
  event: "created" | "canceled" | "rescheduled" | "other";
  uid: string;
  title: string | null;
  start: Date | null;
  end: Date | null;
  name: string | null;
  email: string | null;
  phoneE164: string | null;
}

/** Extracts the invitee from a Cal.com payload. Phone is looked for in the attendee and in any booking answer. */
export function parseCalcom(body: any): Booking {
  const trigger = String(body?.triggerEvent ?? "").toUpperCase();
  const p = body?.payload ?? {};
  const attendee = p.attendees?.[0] ?? {};
  const responses: Record<string, any> = p.responses ?? {};
  const answer = (v: any) => (v && typeof v === "object" && "value" in v ? v.value : v);

  let phone: string | null = toE164(attendee.phoneNumber) ?? toE164(answer(responses.attendeePhoneNumber));
  if (!phone)
    for (const [key, v] of Object.entries(responses)) {
      const val = answer(v);
      if (typeof val === "string" && /phone|mobile|number|whatsapp/i.test(key + " " + (v?.label ?? ""))) {
        phone = toE164(val);
        if (phone) break;
      }
    }
  const email = (attendee.email ?? answer(responses.email) ?? null) as string | null;
  return {
    event: trigger === "BOOKING_CREATED" ? "created" : trigger === "BOOKING_CANCELLED" ? "canceled" : trigger === "BOOKING_RESCHEDULED" ? "rescheduled" : "other",
    uid: String(p.uid ?? p.bookingId ?? ""),
    title: p.title ?? null,
    start: p.startTime ? new Date(p.startTime) : null,
    end: p.endTime ? new Date(p.endTime) : null,
    name: attendee.name ?? answer(responses.name) ?? null,
    email: email ? email.toLowerCase() : null,
    phoneE164: phone,
  };
}

export interface DealMatch {
  callId: string;
  dealId: string | null;
  contactId: string | null;
  claimedBy: string | null;
  matchedBy: "phone" | "email";
}

/**
 * Match the invitee to our most recent lead with a deal: by phone first, then by email via HubSpot.
 * Lookups are injected so the matching order can be unit-tested.
 */
export async function matchBooking(
  b: Booking,
  lookups: {
    byPhone: (e164: string) => Promise<Omit<DealMatch, "matchedBy"> | null>;
    contactIdByEmail: (email: string) => Promise<string | null>;
    byContactId: (contactId: string) => Promise<Omit<DealMatch, "matchedBy"> | null>;
  },
): Promise<DealMatch | null> {
  if (b.phoneE164) {
    const m = await lookups.byPhone(b.phoneE164);
    if (m) return { ...m, matchedBy: "phone" };
  }
  if (b.email) {
    const contactId = await lookups.contactIdByEmail(b.email);
    if (contactId) {
      const m = await lookups.byContactId(contactId);
      if (m) return { ...m, matchedBy: "email" };
    }
  }
  return null;
}
