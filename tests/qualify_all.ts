/**
 * Runs all 40 September enquiries (knowledge/enquiries_sep2026.txt) through the Gemini qualification
 * step and writes tests/output/qualification_results.csv.
 *
 *   npm run qualify-all            # resumable: finished items are cached in tests/output/qualification/
 *   npm run qualify-all -- --force # re-run everything
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { qualify, type QualifyResult } from "../lib/qualify";
import { QuotaExhaustedError } from "../lib/gemini";

const FORCE = process.argv.includes("--force");
const OUT = path.join(process.cwd(), "tests", "output");
const CACHE = path.join(OUT, "qualification");

interface Item { id: string; channel: string; header: string; text: string }

export function splitEnquiries(raw: string): Item[] {
  const lines = raw.replace(/\r|\f/g, "").split("\n"); // pdftotext puts a form feed before page-initial lines
  const items: Item[] = [];
  let cur: Item | null = null;
  for (const line of lines) {
    const m = line.match(/^([TWF])(\d{2})\b(.*)$/);
    if (m) {
      if (cur) items.push(cur);
      const channel = m[1] === "T" ? "phone" : m[1] === "W" ? "whatsapp" : "web_form";
      cur = { id: m[1] + m[2], channel, header: line.trim(), text: "" };
      continue;
    }
    if (/^SECTION \d/.test(line)) { if (cur) items.push(cur); cur = null; continue; }
    if (cur) cur.text += line + "\n";
  }
  if (cur) items.push(cur);
  return items.map((i) => ({ ...i, text: i.text.trim() }));
}

/** "T01 � Phone � 2 September � 10:23am � 4 min" -> date text and after-hours flag (10am–7pm, Mon–Sat). */
function callMeta(header: string): { date: string; afterHours: boolean } {
  const day = header.match(/(\d{1,2})\s*(?:[–-]\s*\d{1,2}\s*)?(September|October)/i);
  const time = header.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  const date = `${day ? `${day[1]} ${day[2]} 2026` : "September 2026"}${time ? `, ${time[0]}` : ""} IST`;
  let afterHours = false;
  if (time) {
    let h = Number(time[1]) % 12;
    if (time[3].toLowerCase() === "pm") h += 12;
    afterHours = h < 10 || h >= 19;
  }
  return { date, afterHours };
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : Array.isArray(v) ? v.join(" | ") : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main() {
  mkdirSync(CACHE, { recursive: true });
  const items = splitEnquiries(readFileSync(path.join(process.cwd(), "knowledge", "enquiries_sep2026.txt"), "utf8"));
  console.log(`Found ${items.length} enquiries`);
  const results = new Map<string, QualifyResult>();
  let quotaHit = false;

  for (const item of items) {
    const file = path.join(CACHE, `${item.id}.json`);
    if (!FORCE && existsSync(file)) { results.set(item.id, JSON.parse(readFileSync(file, "utf8"))); continue; }
    if (quotaHit) continue;
    const meta = callMeta(item.header);
    try {
      const r = await qualify({
        transcript: `${item.header}\n\n${item.text}`,
        callDateIST: meta.date,
        callerIdE164: item.channel === "phone" ? "+910000000000 (anonymised)" : null,
        afterHours: meta.afterHours,
        channel: item.channel,
      });
      writeFileSync(file, JSON.stringify(r, null, 2));
      results.set(item.id, r);
      console.log(`${item.id}  ${r.qualification.status.padEnd(13)} ${r.model}`);
    } catch (err) {
      if (err instanceof QuotaExhaustedError) { quotaHit = true; console.error("Free-tier daily quota exhausted; run again later to continue."); }
      else console.error(`${item.id} ERROR`, String((err as Error).message).slice(0, 200));
    }
  }

  const cols = ["file", "channel", "ai_status", "not_a_lead_tag", "reasons", "missing_info", "name", "phone", "project_type", "location",
    "property_status", "carpet_area_sqft", "scope", "budget", "timeline", "decision_maker", "source", "asked_about_pricing",
    "summary", "model", "input_tokens", "output_tokens"];
  const rows = items.map((item) => {
    const r = results.get(item.id);
    if (!r) return [item.id, item.channel, "PENDING"].map(csvCell).join(",");
    const q = r.qualification;
    const k = q.collected;
    return [item.id, item.channel, q.status, q.not_a_lead_tag, q.reasons, q.missing_info, k.name, k.phone, k.project_type, k.location,
      k.property_status, k.carpet_area_sqft, k.scope, k.budget, k.timeline, k.decision_maker, k.source, k.asked_about_pricing,
      q.summary, r.model, r.inputTokens, r.outputTokens].map(csvCell).join(",");
  });
  writeFileSync(path.join(OUT, "qualification_results.csv"), "﻿" + [cols.join(","), ...rows].join("\n"));
  const done = results.size;
  const counts = [...results.values()].reduce<Record<string, number>>((a, r) => ((a[r.qualification.status] = (a[r.qualification.status] ?? 0) + 1), a), {});
  console.log(`\n${done}/${items.length} done`, counts, "-> tests/output/qualification_results.csv");
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("tests/qualify_all.ts")) main();
