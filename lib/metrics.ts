/**
 * Dashboard metrics for a date range, computed from Neon (deal stages are cached there hourly).
 * Key metric: time to first response. Outcome: conversion. Success: revenue from won deals.
 */
import { sql } from "./db";

export interface CallFact {
  id: string;
  at: Date;
  callerNumber: string | null;
  afterHours: boolean;
  responseTime: number | null;     // ring -> AI answer, seconds
  durationSeconds: number | null;
  providerCostInr: number | null;
  status: string | null;
  name: string | null;
  inputTokens: number;
  outputTokens: number;
  postedAt: Date | null;
  claimedAt: Date | null;
  claimedBy: string | null;
  dealId: string | null;
  dealAmount: number | null;
  dealWon: boolean;
  dealClosed: boolean;
  booked: boolean;
  errorCount: number;
  processing: string;
  recordingUrl: string | null;
}

export async function loadCalls(from: Date, to: Date): Promise<CallFact[]> {
  const rows = (await sql()`
    SELECT c.id, COALESCE(c.started_at, c.received_at) AS at, c.caller_number_e164, c.after_hours, c.response_time_seconds,
           c.duration_seconds, c.provider_cost_inr, c.processing_status, c.recording_url,
           q.status, q.collected->>'name' AS name, COALESCE(q.input_tokens, 0) AS input_tokens, COALESCE(q.output_tokens, 0) AS output_tokens,
           ho.posted_at, ho.claimed_at, ho.claimed_by,
           h.deal_id, h.deal_amount, COALESCE(h.deal_is_won, false) AS deal_is_won, COALESCE(h.deal_is_closed, false) AS deal_is_closed,
           EXISTS (SELECT 1 FROM bookings b WHERE b.call_id = c.id) AS booked,
           (SELECT count(*) FROM errors e WHERE e.call_id = c.id)::int AS error_count
    FROM calls c
    LEFT JOIN qualifications q ON q.call_id = c.id
    LEFT JOIN handoffs ho ON ho.call_id = c.id
    LEFT JOIN hubspot_sync h ON h.call_id = c.id
    WHERE c.processing_status <> 'ignored'
      AND COALESCE(c.started_at, c.received_at) >= ${from} AND COALESCE(c.started_at, c.received_at) < ${to}
    ORDER BY at DESC`) as any[];
  return rows.map((r) => ({
    id: r.id,
    at: new Date(r.at),
    callerNumber: r.caller_number_e164,
    afterHours: r.after_hours,
    responseTime: r.response_time_seconds == null ? null : Number(r.response_time_seconds),
    durationSeconds: r.duration_seconds,
    providerCostInr: r.provider_cost_inr == null ? null : Number(r.provider_cost_inr),
    status: r.status,
    name: r.name,
    inputTokens: Number(r.input_tokens),
    outputTokens: Number(r.output_tokens),
    postedAt: r.posted_at ? new Date(r.posted_at) : null,
    claimedAt: r.claimed_at ? new Date(r.claimed_at) : null,
    claimedBy: r.claimed_by,
    dealId: r.deal_id,
    dealAmount: r.deal_amount == null ? null : Number(r.deal_amount),
    dealWon: r.deal_is_won,
    dealClosed: r.deal_is_closed,
    booked: r.booked,
    errorCount: r.error_count,
    processing: r.processing_status,
    recordingUrl: r.recording_url,
  }));
}

export function quantile(values: number[], q: number): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

const hourIST = (d: Date) =>
  Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(d)) % 24;

export interface CostConfig {
  vaaniPerMin: number;
  geminiInputPerM: number;   // INR per 1M input tokens
  geminiOutputPerM: number;  // INR per 1M output tokens
  fixedMonthly: Record<string, number>;
}

export function costConfig(env: Record<string, string | undefined> = process.env): CostConfig {
  let fixed: Record<string, number> = {};
  try { fixed = JSON.parse(env.FIXED_MONTHLY_COSTS_JSON || "{}"); } catch { /* ignore bad JSON */ }
  return {
    vaaniPerMin: Number(env.VAANI_COST_PER_MIN || 0),
    geminiInputPerM: Number(env.GEMINI_INPUT_PRICE || 0),
    geminiOutputPerM: Number(env.GEMINI_OUTPUT_PRICE || 0),
    fixedMonthly: fixed,
  };
}

export function computeMetrics(calls: CallFact[], from: Date, to: Date, cfg: CostConfig) {
  const byStatus = { qualified: 0, needs_review: 0, not_qualified: 0, not_a_lead: 0, pending: 0 };
  for (const c of calls) {
    if (c.status && c.status in byStatus) byStatus[c.status as keyof typeof byStatus]++;
    else byStatus.pending++;
  }
  const byHour = Array.from({ length: 24 }, () => 0);
  for (const c of calls) byHour[hourIST(c.at)]++;

  // Funnel stages are nested: calls ⊇ enquiries (real projects) ⊇ leads (qualified + needs review,
  // i.e. sent to designers) ⊇ claimed ⊇ booked ⊇ won.
  const enquiries = calls.filter((c) => c.status === "qualified" || c.status === "needs_review" || c.status === "not_qualified");
  const leads = calls.filter((c) => c.status === "qualified" || c.status === "needs_review");
  const claimed = leads.filter((c) => c.claimedAt);
  const booked = leads.filter((c) => c.booked);
  const won = leads.filter((c) => c.dealWon);

  const responseTimes = calls.map((c) => c.responseTime).filter((v): v is number => v != null);
  const claimMinutes = claimed
    .filter((c) => c.postedAt)
    .map((c) => (c.claimedAt!.getTime() - c.postedAt!.getTime()) / 60000)
    .filter((m) => m >= 0);

  const band = (c: CallFact) => {
    if (!c.claimedAt || !c.postedAt) return null;
    const h = (c.claimedAt.getTime() - c.postedAt.getTime()) / 3600000;
    return h < 1 ? 0 : h <= 24 ? 1 : 2;
  };
  const bands = ["Under 1 hour", "1–24 hours", "Over 24 hours"].map((label, i) => {
    const inBand = claimed.filter((c) => band(c) === i);
    return {
      label,
      n: inBand.length,
      values: [inBand.length ? inBand.filter((c) => c.booked).length / inBand.length : 0, inBand.length ? inBand.filter((c) => c.dealWon).length / inBand.length : 0],
    };
  });

  // Money (deal amounts are set by people in HubSpot).
  const openPipeline = leads.filter((c) => c.dealId && !c.dealClosed).reduce((s, c) => s + (c.dealAmount ?? 0), 0);
  const wonValue = won.reduce((s, c) => s + (c.dealAmount ?? 0), 0);

  // Costs.
  const vaani = calls.reduce((s, c) => s + (c.providerCostInr ?? ((c.durationSeconds ?? 0) / 60) * cfg.vaaniPerMin), 0);
  const gemini = calls.reduce((s, c) => s + (c.inputTokens * cfg.geminiInputPerM + c.outputTokens * cfg.geminiOutputPerM) / 1e6, 0);
  const days = Math.max(1, (to.getTime() - from.getTime()) / 86400000);
  const fixedPerMonth = Object.values(cfg.fixedMonthly).reduce((s, v) => s + (Number(v) || 0), 0);
  const fixed = fixedPerMonth * (days / 30.44);
  const totalCost = vaani + gemini + fixed;

  return {
    total: calls.length,
    byStatus,
    byHour,
    afterHoursPct: calls.length ? calls.filter((c) => c.afterHours).length / calls.length : 0,
    responseMedian: quantile(responseTimes, 0.5),
    responseP90: quantile(responseTimes, 0.9),
    claimMedianMin: quantile(claimMinutes, 0.5),
    claimedWithinHourPct: claimed.length ? claimMinutes.filter((m) => m <= 60).length / claimed.length : null,
    funnel: [
      { key: "calls", label: "Calls", value: calls.length },
      { key: "enquiries", label: "Real enquiries", value: enquiries.length },
      { key: "leads", label: "Qualified + review", value: leads.length },
      { key: "claimed", label: "Claimed", value: claimed.length },
      { key: "booked", label: "Booked", value: booked.length },
      { key: "won", label: "Won", value: won.length },
    ],
    bands,
    conversion: leads.length ? won.length / leads.length : null,
    openPipeline,
    wonValue,
    cost: {
      vaani, gemini, fixed, total: totalCost,
      perCall: calls.length ? totalCost / calls.length : null,
      perMonth: totalCost / (days / 30.44),
      perQualified: byStatus.qualified ? totalCost / byStatus.qualified : null,
      roi: totalCost > 0 ? wonValue / totalCost : null,
    },
  };
}
