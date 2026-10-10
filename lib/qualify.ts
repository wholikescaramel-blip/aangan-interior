/**
 * Post-call qualification with Gemini (JSON mode + responseSchema, validated with zod).
 * Inputs: transcript + config/qualification_rules.md + knowledge/services.md. Never pricing.md.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { Type, type Schema } from "@google/genai";
import { z } from "zod";
import { generate, modelPool } from "./gemini";
import { findPriceFigures } from "./price_guard";

export const STATUSES = ["qualified", "needs_review", "not_qualified", "not_a_lead"] as const;
export const NOT_A_LEAD_TAGS = ["vendor", "job_seeker", "spam", "wrong_number", "existing_client", "no_content"] as const;

const nullableStr = z.string().nullable();
export const QualificationSchema = z.object({
  status: z.enum(STATUSES),
  not_a_lead_tag: z.enum(NOT_A_LEAD_TAGS).nullable(),
  reasons: z.array(z.string()).min(1),
  collected: z.object({
    name: nullableStr,
    phone: nullableStr,
    project_type: nullableStr,
    location: nullableStr,
    property_status: nullableStr,
    carpet_area_sqft: z.number().nullable(),
    scope: nullableStr,
    budget: nullableStr,
    timeline: nullableStr,
    decision_maker: nullableStr,
    source: nullableStr,
    asked_about_pricing: z.boolean(),
  }),
  missing_info: z.array(z.string()),
  summary: z.string(),
  suggested_next_step: z.string(),
});
export type Qualification = z.infer<typeof QualificationSchema>;

const s = (description: string): Schema => ({ type: Type.STRING, nullable: true, description });
const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING, enum: [...STATUSES] },
    not_a_lead_tag: { type: Type.STRING, enum: [...NOT_A_LEAD_TAGS], nullable: true, description: "Only when status is not_a_lead" },
    reasons: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Each cites a rule, e.g. 'C2 FAIL: site in Talegaon'" },
    collected: {
      type: Type.OBJECT,
      properties: {
        name: s("Caller's name as said"),
        phone: s("Callback number the caller confirmed or gave; null if neither"),
        project_type: s("home | office | other, as said"),
        location: s("Locality as said"),
        property_status: s("under construction | ready | occupied, as said"),
        carpet_area_sqft: { type: Type.NUMBER, nullable: true, description: "Approx carpet area in sq ft, only if the caller said a number" },
        scope: s("e.g. full home, kitchen + 2 bedrooms, office fit-out"),
        budget: s("Caller's own words if they volunteered a budget; else null"),
        timeline: s("When they need it complete / start, as said"),
        decision_maker: s("Who decides, as said"),
        source: s("How they heard of Aangan"),
        asked_about_pricing: { type: Type.BOOLEAN },
      },
      required: ["name", "phone", "project_type", "location", "property_status", "carpet_area_sqft", "scope",
        "budget", "timeline", "decision_maker", "source", "asked_about_pricing"],
    },
    missing_info: { type: Type.ARRAY, items: { type: Type.STRING } },
    summary: { type: Type.STRING, description: "Max 5 short lines for a designer about to call. No money figures." },
    suggested_next_step: { type: Type.STRING },
  },
  required: ["status", "not_a_lead_tag", "reasons", "collected", "missing_info", "summary", "suggested_next_step"],
  propertyOrdering: ["status", "not_a_lead_tag", "reasons", "collected", "missing_info", "summary", "suggested_next_step"],
};

let knowledgeCache: { rules: string; services: string } | null = null;
function knowledge() {
  // Literal paths so the bundler traces exactly these two files (and never pricing.md).
  knowledgeCache ??= {
    rules: readFileSync(path.join(process.cwd(), "config", "qualification_rules.md"), "utf8"),
    services: readFileSync(path.join(process.cwd(), "knowledge", "services.md"), "utf8"),
  };
  return knowledgeCache;
}

export function systemPrompt(): string {
  const { rules, services } = knowledge();
  return `You qualify phone enquiries for Aangan Studio, an interior design studio in Pune, after the call has ended.
Apply the QUALIFICATION RULES exactly. Use SERVICES only to judge scope and service area.

Hard rules:
- Use only what the caller actually said in the transcript. Never infer or invent a value; use null.
- If uncertain between qualified and not_qualified, return needs_review.
- Never return not_qualified for a caller who passes all five criteria.
- not_a_lead is only for vendors, job seekers, spam, wrong numbers, existing clients, or calls with no content (set not_a_lead_tag).
- Each reason must cite the rule it applies (C1–C5, M1–M5, or a section-5 edge case).
- summary and suggested_next_step must NEVER contain a rupee amount, "lakh", "crore" or any per-sq-ft rate, not even the caller's own budget. Write "Budget: mentioned by caller" or "Budget: not mentioned".
- summary: at most 5 short lines, written for a designer about to call back. Mention pricing questions, frustration, repeat calls, and anything to handle with care.
- Judge timelines relative to the CALL DATE given.

===== QUALIFICATION RULES =====
${rules}

===== SERVICES =====
${services}`;
}

export interface QualifyInput {
  transcript: string;
  callDateIST: string;
  callerIdE164: string | null;
  afterHours: boolean;
  channel: string;
}

export interface QualifyResult {
  qualification: Qualification;
  model: string;
  inputTokens: number;
  outputTokens: number;
  attempts: number;
  error: string | null;
}

export async function qualify(input: QualifyInput): Promise<QualifyResult> {
  const user = `CALL DATE (IST): ${input.callDateIST}
CHANNEL: ${input.channel}
CALLER ID: ${input.callerIdE164 ?? "(withheld)"}
AFTER HOURS: ${input.afterHours}

TRANSCRIPT:
${input.transcript}`;
  let inputTokens = 0;
  let outputTokens = 0;
  let model = "";
  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = await generate({
      system: systemPrompt(),
      contents: user,
      json: { schema: responseSchema },
      temperature: 0,
      models: modelPool(),
    });
    inputTokens += r.usage.inputTokens;
    outputTokens += r.usage.outputTokens;
    model = r.model;
    try {
      const parsed = QualificationSchema.parse(JSON.parse(r.text));
      return { qualification: sanitize(parsed), model, inputTokens, outputTokens, attempts: attempt, error: null };
    } catch (err) {
      lastError = `Invalid JSON from ${model} (attempt ${attempt}): ${String((err as Error).message).slice(0, 500)}`;
    }
  }
  return {
    qualification: fallbackNeedsReview(lastError, input.callerIdE164),
    model, inputTokens, outputTokens, attempts: 2, error: lastError,
  };
}

/** Enforce output hygiene even if the model slips: no money figures in designer-facing text. */
export function sanitize(q: Qualification): Qualification {
  const clean = (text: string) =>
    text
      .split(/\n|(?<=[.!?])\s+/)
      .map((part) => (findPriceFigures(part).length ? "Budget: mentioned by caller." : part))
      .filter((part, i, arr) => part.trim() && !(part === "Budget: mentioned by caller." && arr.indexOf(part) !== i))
      .join(" ")
      .trim();
  return {
    ...q,
    not_a_lead_tag: q.status === "not_a_lead" ? q.not_a_lead_tag : null,
    summary: clean(q.summary),
    suggested_next_step: clean(q.suggested_next_step),
    reasons: q.reasons.map((r) => (findPriceFigures(r).length ? r.replace(/₹?\s?[\d.,]+\s*(lakh|lac|crore|k)?/gi, "[figure]") : r)),
  };
}

export function fallbackNeedsReview(error: string, phone: string | null): Qualification {
  return {
    status: "needs_review",
    not_a_lead_tag: null,
    reasons: ["AI qualification failed; a person needs to read the transcript"],
    collected: {
      name: null, phone, project_type: null, location: null, property_status: null, carpet_area_sqft: null,
      scope: null, budget: null, timeline: null, decision_maker: null, source: null, asked_about_pricing: false,
    },
    missing_info: ["AI qualification failed"],
    summary: `Automatic qualification failed (${error.slice(0, 120)}). Please read the transcript.`,
    suggested_next_step: "Read the transcript and call the caller back.",
  };
}
