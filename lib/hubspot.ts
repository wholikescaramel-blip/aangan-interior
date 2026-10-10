/**
 * Minimal HubSpot CRM client (private app token). In DRY_RUN, writes are logged and skipped;
 * reads still happen if a token is present.
 *
 * The system only ever moves a deal: on creation, to DESIGNER_CONTACTED on claim, and to
 * CONSULT_BOOKED on a booking. Won/lost are set by people in HubSpot.
 */
import { hubspotEnabled } from "./env";

const BASE = "https://api.hubapi.com";

// HubSpot-defined association type ids.
const ASSOC = { callToContact: 194, callToDeal: 206, dealToContact: 3, meetingToContact: 200, meetingToDeal: 212 };

export const DEAL_PROPERTIES = [
  { name: "enquiry_channel", label: "Enquiry channel", type: "string", fieldType: "text" },
  { name: "response_time_seconds", label: "Response time (seconds)", type: "number", fieldType: "number" },
  { name: "asked_about_pricing", label: "Asked about pricing", type: "enumeration", fieldType: "booleancheckbox",
    options: [{ label: "Yes", value: "true" }, { label: "No", value: "false" }] },
  { name: "call_after_hours", label: "Call after hours", type: "enumeration", fieldType: "booleancheckbox",
    options: [{ label: "Yes", value: "true" }, { label: "No", value: "false" }] },
  { name: "ai_qualification_reasons", label: "AI qualification reasons", type: "string", fieldType: "textarea" },
  { name: "assigned_designer", label: "Assigned designer", type: "string", fieldType: "text" },
] as const;

export type HubspotFetch = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;

export function makeHubspotFetch(token = process.env.HUBSPOT_TOKEN, fetchImpl: typeof fetch = fetch): HubspotFetch {
  return async (path, init = {}) => {
    if (!token) throw new Error("HUBSPOT_TOKEN is not set");
    const res = await fetchImpl(BASE + path, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HubSpot ${init.method ?? "GET"} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
    return text ? JSON.parse(text) : null;
  };
}

export class HubSpot {
  constructor(
    private readonly hs: HubspotFetch = makeHubspotFetch(),
    private readonly dryRun = !hubspotEnabled(),
  ) {}

  private async write(desc: string, path: string, method: string, body: unknown): Promise<any> {
    if (this.dryRun) {
      console.log(`[DRY_RUN] HubSpot ${method} ${path} (${desc})`, JSON.stringify(body).slice(0, 400));
      return { id: null };
    }
    return this.hs(path, { method, body });
  }

  async findContactByPhone(e164: string): Promise<string | null> {
    if (this.dryRun && !process.env.HUBSPOT_TOKEN) return null;
    const r = await this.hs("/crm/v3/objects/contacts/search", {
      method: "POST",
      body: {
        filterGroups: [
          { filters: [{ propertyName: "phone", operator: "EQ", value: e164 }] },
          { filters: [{ propertyName: "mobilephone", operator: "EQ", value: e164 }] },
        ],
        properties: ["phone", "firstname", "lastname"],
        sorts: [{ propertyName: "createdate", direction: "ASCENDING" }],
        limit: 1,
      },
    });
    return r?.results?.[0]?.id ?? null;
  }

  async findContactByEmail(email: string): Promise<string | null> {
    if (this.dryRun && !process.env.HUBSPOT_TOKEN) return null;
    const r = await this.hs("/crm/v3/objects/contacts/search", {
      method: "POST",
      body: { filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email.toLowerCase() }] }], limit: 1 },
    });
    return r?.results?.[0]?.id ?? null;
  }

  /** Upsert by E.164 phone: update if found (never blanking known fields), else create. */
  async upsertContact(c: { phone: string; name: string | null; source: string | null; email?: string | null }): Promise<string | null> {
    const [firstname, ...rest] = (c.name ?? "").trim().split(/\s+/).filter(Boolean);
    const props: Record<string, string> = { phone: c.phone };
    if (firstname) props.firstname = firstname;
    if (rest.length) props.lastname = rest.join(" ");
    if (c.email) props.email = c.email.toLowerCase();
    if (c.source) props.message = `Heard of Aangan via: ${c.source}`;
    const existing = await this.findContactByPhone(c.phone);
    if (existing) {
      await this.write("update contact", `/crm/v3/objects/contacts/${existing}`, "PATCH", { properties: props });
      return existing;
    }
    const created = await this.write("create contact", "/crm/v3/objects/contacts", "POST", {
      properties: { ...props, lifecyclestage: "lead" },
    });
    return created?.id ?? null;
  }

  async logCall(c: {
    contactId: string | null;
    dealId?: string | null;
    timestamp: Date;
    title: string;
    body: string;
    durationSeconds: number | null;
    recordingUrl: string | null;
    fromNumber: string | null;
  }): Promise<string | null> {
    const associations = [
      c.contactId && { to: { id: c.contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: ASSOC.callToContact }] },
      c.dealId && { to: { id: c.dealId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: ASSOC.callToDeal }] },
    ].filter(Boolean);
    const r = await this.write("log call", "/crm/v3/objects/calls", "POST", {
      properties: {
        hs_timestamp: c.timestamp.toISOString(),
        hs_call_title: c.title,
        hs_call_body: c.body,
        hs_call_direction: "INBOUND",
        hs_call_status: "COMPLETED",
        ...(c.durationSeconds != null ? { hs_call_duration: String(c.durationSeconds * 1000) } : {}),
        ...(c.recordingUrl ? { hs_call_recording_url: c.recordingUrl } : {}),
        ...(c.fromNumber ? { hs_call_from_number: c.fromNumber } : {}),
      },
      associations,
    });
    return r?.id ?? null;
  }

  async createDeal(d: { name: string; stageId: string; contactId: string | null; properties: Record<string, string> }): Promise<string | null> {
    const r = await this.write("create deal", "/crm/v3/objects/deals", "POST", {
      properties: { dealname: d.name, pipeline: process.env.HUBSPOT_PIPELINE_ID, dealstage: d.stageId, ...d.properties },
      associations: d.contactId
        ? [{ to: { id: d.contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: ASSOC.dealToContact }] }]
        : [],
    });
    return r?.id ?? null;
  }

  async updateDeal(dealId: string, properties: Record<string, string>): Promise<void> {
    await this.write("update deal", `/crm/v3/objects/deals/${dealId}`, "PATCH", { properties });
  }

  async logMeeting(m: { contactId: string | null; dealId: string | null; title: string; start: Date; end: Date | null; body: string }): Promise<string | null> {
    const associations = [
      m.contactId && { to: { id: m.contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: ASSOC.meetingToContact }] },
      m.dealId && { to: { id: m.dealId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: ASSOC.meetingToDeal }] },
    ].filter(Boolean);
    const r = await this.write("log meeting", "/crm/v3/objects/meetings", "POST", {
      properties: {
        hs_timestamp: m.start.toISOString(),
        hs_meeting_title: m.title,
        hs_meeting_body: m.body,
        hs_meeting_start_time: m.start.toISOString(),
        ...(m.end ? { hs_meeting_end_time: m.end.toISOString() } : {}),
        hs_meeting_outcome: "SCHEDULED",
      },
      associations,
    });
    return r?.id ?? null;
  }

  /** Batch-read deal stage/amount/won flags (used by the hourly sync). */
  async readDeals(ids: string[]): Promise<Array<{ id: string; stage: string | null; amount: number | null; isWon: boolean; isClosed: boolean }>> {
    const out: Array<{ id: string; stage: string | null; amount: number | null; isWon: boolean; isClosed: boolean }> = [];
    for (let i = 0; i < ids.length; i += 100) {
      const r = await this.hs("/crm/v3/objects/deals/batch/read", {
        method: "POST",
        body: { properties: ["dealstage", "amount", "hs_is_closed_won", "hs_is_closed"], inputs: ids.slice(i, i + 100).map((id) => ({ id })) },
      });
      for (const d of r?.results ?? [])
        out.push({
          id: d.id,
          stage: d.properties?.dealstage ?? null,
          amount: d.properties?.amount ? Number(d.properties.amount) : null,
          isWon: d.properties?.hs_is_closed_won === "true",
          isClosed: d.properties?.hs_is_closed === "true",
        });
    }
    return out;
  }
}

export function dealUrl(dealId: string | null): string | null {
  const portal = process.env.HUBSPOT_PORTAL_ID;
  return dealId && portal ? `https://app.hubspot.com/contacts/${portal}/record/0-3/${dealId}` : null;
}
