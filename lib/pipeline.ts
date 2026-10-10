/**
 * After-call pipeline: store -> qualify (Gemini) -> HubSpot -> Telegram.
 * Every step is idempotent (keyed on the call row and the ids already stored), so a retried
 * webhook or a re-run of a failed call never creates a second record, HubSpot object or post.
 */
import type { Enquiry } from "./enquiry";
import { responseTimeSeconds } from "./enquiry";
import { sql, logError } from "./db";
import { isBusinessHoursIST } from "./prompt";
import { qualify, type Qualification } from "./qualify";
import { HubSpot, dealUrl } from "./hubspot";
import { claimKeyboard, formatIST, formatLeadMessage, leadChatId, tg } from "./telegram";
import { appUrl, hubspotEnabled, isDryRun, sendNeedsReview } from "./env";

export interface CallRow {
  id: string;
  channel: string;
  external_id: string;
  caller_number_e164: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  response_time_seconds: number | null;
  after_hours: boolean;
  transcript: string | null;
  recording_url: string | null;
  received_at: string;
  processing_status: string;
}

/** Insert the enquiry once. Returns the new call id, or null if this external id was already stored. */
export async function storeEnquiry(e: Enquiry): Promise<string | null> {
  const callTime = e.startedAt ?? e.endedAt ?? new Date();
  const rows = (await sql()`
    INSERT INTO calls (channel, external_id, caller_number_e164, started_at, answered_at, ended_at, duration_seconds,
                       response_time_seconds, after_hours, transcript, recording_url, structured, provider_cost_inr,
                       raw_payload, processing_status)
    VALUES (${e.channel}, ${e.externalId}, ${e.callerNumberE164}, ${e.startedAt}, ${e.answeredAt}, ${e.endedAt},
            ${e.durationSeconds}, ${responseTimeSeconds(e)}, ${!isBusinessHoursIST(callTime)}, ${e.transcript},
            ${e.recordingUrl}, ${JSON.stringify(e.structured)}, ${e.providerCostInr}, ${JSON.stringify(e.raw)},
            ${e.isComplete ? "received" : "ignored"})
    ON CONFLICT (channel, external_id) DO NOTHING
    RETURNING id`) as { id: string }[];
  return rows[0]?.id ?? null;
}

async function withOneRetry<T>(stage: string, callId: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (first) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      return await fn();
    } catch (second) {
      await logError(stage, String((second as Error).message ?? second), { first: String((first as Error)?.message ?? first) }, callId);
      throw second;
    }
  }
}

/** Runs the pipeline for one call. Safe to call repeatedly; only one run proceeds at a time. */
export async function processCall(callId: string): Promise<void> {
  const claimed = (await sql()`
    UPDATE calls SET processing_status = 'processing'
    WHERE id = ${callId} AND (processing_status IN ('received', 'failed')
           OR (processing_status = 'processing' AND received_at < now() - interval '5 minutes'))
    RETURNING *`) as CallRow[];
  const call = claimed[0];
  if (!call) return; // already processing / done / ignored

  try {
    const q = await withOneRetry("qualify", call.id, () => ensureQualification(call));
    const hs = await withOneRetry("hubspot", call.id, () => syncHubspot(call, q));
    await withOneRetry("telegram", call.id, () => ensureTelegramPost(call, q, hs.dealId));
    await sql()`UPDATE calls SET processing_status = 'done' WHERE id = ${call.id}`;
  } catch {
    await sql()`UPDATE calls SET processing_status = 'failed' WHERE id = ${call.id}`;
  }
}

async function ensureQualification(call: CallRow): Promise<Qualification> {
  const existing = (await sql()`SELECT * FROM qualifications WHERE call_id = ${call.id}`) as any[];
  if (existing[0]) return rowToQualification(existing[0]);

  const when = new Date(call.started_at ?? call.received_at);
  const r = await qualify({
    transcript: call.transcript ?? "(no transcript)",
    callDateIST: formatIST(when),
    callerIdE164: call.caller_number_e164,
    afterHours: call.after_hours,
    channel: call.channel,
  });
  const q = r.qualification;
  await sql()`
    INSERT INTO qualifications (call_id, status, reasons, collected, missing_info, summary, suggested_next_step,
                                not_a_lead_tag, model, input_tokens, output_tokens, attempts, error)
    VALUES (${call.id}, ${q.status}, ${JSON.stringify(q.reasons)}, ${JSON.stringify(q.collected)},
            ${JSON.stringify(q.missing_info)}, ${q.summary}, ${q.suggested_next_step}, ${q.not_a_lead_tag},
            ${r.model}, ${r.inputTokens}, ${r.outputTokens}, ${r.attempts}, ${r.error})
    ON CONFLICT (call_id) DO NOTHING`;
  if (r.error) await logError("qualify", r.error, null, call.id);
  return q;
}

export function rowToQualification(row: any): Qualification {
  return {
    status: row.status,
    not_a_lead_tag: row.not_a_lead_tag,
    reasons: row.reasons,
    collected: row.collected,
    missing_info: row.missing_info,
    summary: row.summary ?? "",
    suggested_next_step: row.suggested_next_step ?? "",
  };
}

const STATUS_LABEL: Record<Qualification["status"], string> = {
  qualified: "Qualified",
  needs_review: "Needs review",
  not_qualified: "Not qualified",
  not_a_lead: "Not a lead",
};

export function dealName(q: Qualification): string {
  const c = q.collected;
  const type = c.project_type ? c.project_type[0].toUpperCase() + c.project_type.slice(1) : "Project";
  const area = c.carpet_area_sqft ? `${Math.round(c.carpet_area_sqft)} sqft` : "? sqft";
  return `${c.name ?? "Unknown caller"} - ${type} - ${area}`;
}

/** Contact + call for every call; deal only for qualified / needs_review. Idempotent via hubspot_sync. */
export async function syncHubspot(call: CallRow, q: Qualification, hubspot = new HubSpot()): Promise<{ dealId: string | null }> {
  await sql()`INSERT INTO hubspot_sync (call_id) VALUES (${call.id}) ON CONFLICT (call_id) DO NOTHING`;
  const state = ((await sql()`SELECT * FROM hubspot_sync WHERE call_id = ${call.id}`) as any[])[0];
  let { contact_id: contactId, deal_id: dealId, call_engagement_id: engagementId } = state;
  const phone = call.caller_number_e164 ?? q.collected.phone;
  const isSpam = q.status === "not_a_lead" && (q.not_a_lead_tag === "spam" || q.not_a_lead_tag === "wrong_number" || q.not_a_lead_tag === "no_content");

  if (!contactId && phone && !isSpam) {
    contactId = await hubspot.upsertContact({ phone, name: q.collected.name, source: q.collected.source });
    if (contactId) await sql()`UPDATE hubspot_sync SET contact_id = ${contactId}, updated_at = now() WHERE call_id = ${call.id}`;
  }

  const wantsDeal = q.status === "qualified" || q.status === "needs_review";
  if (wantsDeal && !dealId) {
    const stageId = q.status === "qualified" ? process.env.HUBSPOT_STAGE_QUALIFIED : process.env.HUBSPOT_STAGE_NEEDS_REVIEW;
    if (!stageId && hubspotEnabled()) throw new Error("HUBSPOT_STAGE_QUALIFIED / HUBSPOT_STAGE_NEEDS_REVIEW not set");
    dealId = await hubspot.createDeal({
      name: dealName(q),
      stageId: stageId ?? "",
      contactId,
      // Amount left empty: qualified.md defines no estimate method.
      properties: {
        enquiry_channel: call.channel,
        ...(call.response_time_seconds != null ? { response_time_seconds: String(call.response_time_seconds) } : {}),
        asked_about_pricing: String(q.collected.asked_about_pricing),
        call_after_hours: String(call.after_hours),
        ai_qualification_reasons: q.reasons.join("\n").slice(0, 60000),
        assigned_designer: "",
      },
    });
    if (dealId)
      await sql()`UPDATE hubspot_sync SET deal_id = ${dealId}, deal_stage = ${stageId ?? null}, updated_at = now() WHERE call_id = ${call.id}`;
  }

  if (!engagementId) {
    const tag = q.status === "not_a_lead" ? ` [not a lead: ${q.not_a_lead_tag ?? "other"}]` : "";
    engagementId = await hubspot.logCall({
      contactId,
      dealId,
      timestamp: new Date(call.started_at ?? call.received_at),
      title: `Inbound call (AI) - ${STATUS_LABEL[q.status]}${tag}`,
      body: [
        q.summary,
        "",
        `Status: ${STATUS_LABEL[q.status]}`,
        `Reasons: ${q.reasons.join("; ")}`,
        `Response time: ${call.response_time_seconds ?? "n/a"} s · After hours: ${call.after_hours ? "yes" : "no"}`,
        `Transcript: ${appUrl(`/dashboard/calls/${call.id}`)}`,
        call.recording_url ? `Recording: ${call.recording_url}` : "",
      ].filter(Boolean).join("\n"),
      durationSeconds: call.duration_seconds,
      recordingUrl: call.recording_url,
      fromNumber: phone,
    });
    if (engagementId)
      await sql()`UPDATE hubspot_sync SET call_engagement_id = ${engagementId}, updated_at = now() WHERE call_id = ${call.id}`;
  }
  return { dealId };
}

/** Posts the lead card once. The handoffs row is reserved first so concurrent runs can't double-post. */
export async function ensureTelegramPost(call: CallRow, q: Qualification, dealId: string | null): Promise<void> {
  const shouldPost = q.status === "qualified" || (q.status === "needs_review" && sendNeedsReview());
  if (!shouldPost) return;
  const chatId = leadChatId();
  await sql()`INSERT INTO handoffs (call_id, telegram_chat_id) VALUES (${call.id}, ${chatId}) ON CONFLICT (call_id) DO NOTHING`;
  const reserved = (await sql()`
    UPDATE handoffs SET posted_at = now()
    WHERE call_id = ${call.id} AND posted_at IS NULL
    RETURNING call_id`) as unknown[];
  if (!reserved.length) return; // already posted (or being posted)

  try {
    const text = formatLeadMessage({
      q,
      phone: call.caller_number_e164,
      callTime: new Date(call.started_at ?? call.received_at),
      afterHours: call.after_hours,
      links: {
        deal: dealUrl(dealId),
        transcript: appUrl(`/dashboard/calls/${call.id}`),
        recording: call.recording_url,
        booking: process.env.CALCOM_LINK || null,
      },
      dryRun: isDryRun(),
    });
    const msg = await tg("sendMessage", {
      chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: claimKeyboard(call.id),
    });
    await sql()`UPDATE handoffs SET telegram_message_id = ${msg.message_id}, posted_at = now() WHERE call_id = ${call.id}`;
  } catch (err) {
    // Release the reservation so the retry can post.
    await sql()`UPDATE handoffs SET posted_at = NULL WHERE call_id = ${call.id} AND telegram_message_id IS NULL`;
    throw err;
  }
}
