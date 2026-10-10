import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { formatLeadMessage, assertNoPrice } from "../../lib/telegram";
import { redactMoney, sanitize, type Qualification } from "../../lib/qualify";
import { HubSpot, type HubspotFetch } from "../../lib/hubspot";
import { matchBooking, parseCalcom, verifyCalcom } from "../../lib/calcom";
import { parseVaaniPayload, transcriptToText } from "../../lib/vaani";
import { dealName } from "../../lib/pipeline";
import { containsPriceFigure } from "../../lib/price_guard";

const baseQ: Qualification = {
  status: "qualified",
  not_a_lead_tag: null,
  reasons: ["C1 PASS: full home with execution", "C2 PASS: Kothrud", "C3 PASS: complete by March"],
  collected: {
    name: "Priya Joshi", phone: "+919876543210", project_type: "home", location: "Kothrud", property_status: "occupied",
    carpet_area_sqft: 1400, scope: "full home", budget: null, timeline: "by March", decision_maker: "owner with husband",
    source: "referral (Shruti Joshi)", asked_about_pricing: true,
  },
  missing_info: [],
  summary: "3BHK in Kothrud, full redesign.\nReferred by a past client.\nAsked about pricing once.",
  suggested_next_step: "Call and share the booking link.",
};
const card = (q: Qualification) =>
  formatLeadMessage({
    q, phone: "+919876543210", callTime: new Date("2026-10-10T09:15:00Z"), afterHours: false,
    links: { deal: "https://app.hubspot.com/contacts/1/record/0-3/42", transcript: "https://x.app/dashboard/calls/abc", recording: null, booking: "https://cal.com/aangan/consult" },
  });

describe("Telegram formatting", () => {
  it("contains the required fields, scannable", () => {
    const t = card(baseQ);
    expect(t).toMatch(/^🟢 <b>QUALIFIED<\/b>/);
    expect(t).toContain("<b>Priya Joshi</b> · +919876543210");
    expect(t).toContain("Project: home · full home · 1,400 sq ft · Kothrud · occupied");
    expect(t).toContain("Budget: not mentioned · Timeline: by March · Heard of us via: referral (Shruti Joshi)");
    expect(t).toContain("💬 Asked about pricing: yes");
    expect(t).toContain(">HubSpot deal</a>");
    expect(t).toContain(">Booking link</a>");
    expect(t).toContain("10 Oct, 2:45 pm IST");
  });

  it("needs_review header and missing info", () => {
    const t = card({ ...baseQ, status: "needs_review", missing_info: ["timeline"] });
    expect(t).toMatch(/🟡 <b>NEEDS REVIEW<\/b>/);
    expect(t).toContain("Missing: timeline");
  });

  it("escapes HTML from caller-provided text", () => {
    const t = card({ ...baseQ, collected: { ...baseQ.collected, name: "<script>x</script>" } });
    expect(t).toContain("&lt;script&gt;");
  });
});

describe("no rupee figure or per-sq-ft rate ever reaches Telegram or the summary", () => {
  const leaky: Qualification = {
    ...baseQ,
    collected: { ...baseQ.collected, budget: "15-20 lakh", timeline: "by March, budget ₹18 lakh" },
    summary: "Full home in Kothrud. Budget around 15 lakh. Wants rates per sq ft.\nOther studio quoted ₹1,500/sq ft.",
    suggested_next_step: "Discuss whether 15 lakh is enough.",
  };

  it("sanitize() strips figures from summary and next step", () => {
    const s = sanitize(leaky);
    expect(containsPriceFigure(s.summary)).toBe(false);
    expect(containsPriceFigure(s.suggested_next_step)).toBe(false);
    expect(s.summary).toContain("Budget: mentioned by caller.");
  });

  it("the card never shows the budget figure or any leaked figure", () => {
    const t = card(leaky); // formatLeadMessage would throw if a figure survived
    expect(containsPriceFigure(t)).toBe(false);
    expect(t).toContain("Budget: mentioned by caller");
  });

  it("redactMoney removes amounts but keeps rule ids and areas", () => {
    const r = redactMoney("C4 FAIL: volunteered budget of 1 to 1.5 lakh for 550 sq ft; competitor said ₹1,500/sq ft");
    expect(r).toContain("C4 FAIL");
    expect(r).toContain("550 sq ft");
    expect(containsPriceFigure(r)).toBe(false);
    expect(redactMoney("C2 PASS: Baner")).toBe("C2 PASS: Baner");
  });

  it("assertNoPrice refuses a message with a figure", () => {
    expect(() => assertNoPrice("Approx ₹2,000 per sq ft")).toThrow();
    expect(() => assertNoPrice("1,400 sq ft in Baner")).not.toThrow();
  });
});

describe("HubSpot dedupe by phone", () => {
  function fakeHubspot(existing: Record<string, string>) {
    const calls: Array<{ path: string; method: string; body: any }> = [];
    const hs: HubspotFetch = async (path, init = {}) => {
      calls.push({ path, method: init.method ?? "GET", body: init.body });
      if (path.endsWith("/contacts/search")) {
        const phone = (init.body as any).filterGroups[0].filters[0].value;
        return { results: existing[phone] ? [{ id: existing[phone] }] : [] };
      }
      if (path === "/crm/v3/objects/contacts" && init.method === "POST") {
        const id = "new-" + Object.keys(existing).length;
        existing[(init.body as any).properties.phone] = id;
        return { id };
      }
      return { id: "x" };
    };
    return { client: new HubSpot(hs, false), calls };
  }

  it("updates the existing contact instead of creating a duplicate", async () => {
    const { client, calls } = fakeHubspot({ "+919876543210": "c1" });
    const id = await client.upsertContact({ phone: "+919876543210", name: "Priya Joshi", source: null });
    expect(id).toBe("c1");
    expect(calls.some((c) => c.method === "PATCH" && c.path.endsWith("/contacts/c1"))).toBe(true);
    expect(calls.some((c) => c.method === "POST" && c.path === "/crm/v3/objects/contacts")).toBe(false);
  });

  it("creates once, then the second call for the same number updates", async () => {
    const { client, calls } = fakeHubspot({});
    const a = await client.upsertContact({ phone: "+919800000001", name: "A B", source: null });
    const b = await client.upsertContact({ phone: "+919800000001", name: null, source: null });
    expect(a).toBe(b);
    expect(calls.filter((c) => c.method === "POST" && c.path === "/crm/v3/objects/contacts")).toHaveLength(1);
    // A missing name on a later call must not blank the stored name.
    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch?.body.properties.firstname).toBeUndefined();
  });

  it("DRY_RUN performs no writes", async () => {
    const hs = vi.fn(async (_path: string, _init?: unknown) => ({ results: [] }));
    const id = await new HubSpot(hs, true).upsertContact({ phone: "+919800000002", name: "X", source: null });
    expect(id).toBeNull();
    expect(hs.mock.calls.every(([path]) => String(path).endsWith("/search"))).toBe(true);
  });

  it("deal name format", () => {
    expect(dealName(baseQ)).toBe("Priya Joshi - Home - 1400 sqft");
  });
});

describe("Cal.com", () => {
  const body = {
    triggerEvent: "BOOKING_CREATED",
    payload: {
      uid: "bk_1", title: "Free design consultation", startTime: "2026-10-14T05:30:00Z", endTime: "2026-10-14T06:00:00Z",
      attendees: [{ name: "Priya Joshi", email: "Priya@Example.com" }],
      responses: { name: { value: "Priya Joshi" }, email: { value: "priya@example.com" }, phone: { label: "Phone number", value: "98765 43210" } },
    },
  };

  it("verifies the HMAC signature", () => {
    const raw = JSON.stringify(body);
    const sig = createHmac("sha256", "s3cret").update(raw).digest("hex");
    expect(verifyCalcom(raw, sig, "s3cret")).toBe(true);
    expect(verifyCalcom(raw, sig, "other")).toBe(false);
    expect(verifyCalcom(raw + " ", sig, "s3cret")).toBe(false);
  });

  it("parses invitee phone from a booking question and lowercases email", () => {
    const b = parseCalcom(body);
    expect(b).toMatchObject({ event: "created", uid: "bk_1", phoneE164: "+919876543210", email: "priya@example.com" });
  });

  const lead = { callId: "call-1", dealId: "d1", contactId: "c1", claimedBy: "Asha" };

  it("matches by phone first", async () => {
    const contactIdByEmail = vi.fn();
    const m = await matchBooking(parseCalcom(body), {
      byPhone: async (p) => (p === "+919876543210" ? lead : null),
      contactIdByEmail,
      byContactId: async () => null,
    });
    expect(m?.matchedBy).toBe("phone");
    expect(contactIdByEmail).not.toHaveBeenCalled();
  });

  it("falls back to email when the phone doesn't match", async () => {
    const m = await matchBooking(parseCalcom(body), {
      byPhone: async () => null,
      contactIdByEmail: async (e) => (e === "priya@example.com" ? "c1" : null),
      byContactId: async (id) => (id === "c1" ? lead : null),
    });
    expect(m).toMatchObject({ matchedBy: "email", dealId: "d1" });
  });

  it("returns null when nothing matches", async () => {
    const m = await matchBooking(parseCalcom(body), { byPhone: async () => null, contactIdByEmail: async () => null, byContactId: async () => null });
    expect(m).toBeNull();
  });
});

describe("Vaani adapter (interim field mapping)", () => {
  it("reads common field names and builds a transcript", () => {
    const raw = {
      call_id: "v-123", from: "09876543210", started_at: "2026-10-10T09:00:00Z", answered_at: "2026-10-10T09:00:03Z",
      ended_at: "2026-10-10T09:04:00Z", recording_url: "https://rec/1.mp3",
      transcript: [{ role: "assistant", content: "Namaste!" }, { role: "user", content: "Home, in Baner." }],
    };
    const e = parseVaaniPayload(raw, JSON.stringify(raw));
    expect(e).toMatchObject({ externalId: "v-123", callerNumberE164: "+919876543210", durationSeconds: 240, isComplete: true });
    expect(e.transcript).toBe("Agent: Namaste!\nCaller: Home, in Baner.");
  });

  it("falls back to a body hash so identical retries share an id", () => {
    const raw = { transcript: "hi" };
    const a = parseVaaniPayload(raw, JSON.stringify(raw));
    const b = parseVaaniPayload(raw, JSON.stringify(raw));
    expect(a.externalId).toMatch(/^sha256:/);
    expect(a.externalId).toBe(b.externalId);
  });

  it("call-started events are not processed", () => {
    expect(parseVaaniPayload({ id: "1", event: "call_started" }, "{}").isComplete).toBe(false);
    expect(transcriptToText(null)).toBeNull();
  });
});

describe("Vaani documented format (call_postprocessing)", () => {
  it("converts the timestamped transcript and joins the room's phone/timing", async () => {
    const { parseVaaniPostprocessing, vaaniTranscript } = await import("../../lib/vaani");
    expect(vaaniTranscript("[13:33:14] AGENT: Namaste!\n\n [13:33:20] USER: Home, in Baner.")).toBe("Agent: Namaste!\nCaller: Home, in Baner.");
    const e = parseVaaniPostprocessing(
      { event: "call_postprocessing", call_id: "inbound-1-abc", timestamp: "2026-10-10T09:05:00Z",
        data: { room_name: "room-1", call_id: "inbound-1-abc", call_duration: 180500.5, transcript: "[13:33:14] AGENT: Hi\n\n[13:33:20] USER: Hello", recording_url: "https://rec/1.mp3", summary: "s", entities: { a: 1 } } },
      { phone_number: "09876543210", started_at: "2026-10-10T09:01:00Z", picked_up_at: "2026-10-10T09:01:02Z", ended_at: "2026-10-10T09:04:00Z" },
    );
    expect(e).toMatchObject({ externalId: "inbound-1-abc", callerNumberE164: "+919876543210", durationSeconds: 181, recordingUrl: "https://rec/1.mp3", isComplete: true });
    expect(e.transcript).toBe("Agent: Hi\nCaller: Hello");
    expect(e.answeredAt!.getTime() - e.startedAt!.getTime()).toBe(2000);
  });
});
