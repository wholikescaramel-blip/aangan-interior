/**
 * Agent prompt test: Gemini plays both the Vaani agent (with agent/vaani_prompt_<v>.md) and a
 * simulated caller per persona; an LLM judge scores each dialogue against the checklist.
 *
 *   npm run simulate                       # all personas
 *   npm run simulate -- --only vendor,t02_wakad_price
 *   npm run simulate -- --prompt v1        # test another prompt version
 *   npm run simulate -- --force            # re-run personas that already have a result
 *
 * Free-tier friendly: each role uses a pool of models (SIM_AGENT_MODELS, SIM_CALLER_MODELS,
 * SIM_JUDGE_MODELS) and falls through to the next when one hits its daily quota. Finished personas
 * are saved and skipped on the next run, so a full run can span several days of free quota.
 *
 * Output: tests/output/simulations/<prompt>/<persona>.md and report.md / report.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Type, type Content, type Schema } from "@google/genai";
import { generate, modelPool, QuotaExhaustedError } from "../lib/gemini";
import { findPriceFigures } from "../lib/price_guard";
import { renderAgentPrompt, AGENT_PROMPT_VERSION } from "../lib/prompt";
import { PERSONAS, type Persona } from "./personas";

const args = process.argv.slice(2);
const argVal = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const PROMPT_VERSION = argVal("--prompt") ?? AGENT_PROMPT_VERSION;
const ONLY = argVal("--only")?.split(",");
const CONCURRENCY = Number(argVal("--concurrency") ?? 1);
const FORCE = args.includes("--force");
const MAX_AGENT_TURNS = 25;

const AGENT_MODELS = modelPool("", process.env.SIM_AGENT_MODELS || "gemini-3.5-flash,gemini-3.6-flash,gemini-3.7-flash,gemini-3.5-flash-lite");
const CALLER_MODELS = modelPool("", process.env.SIM_CALLER_MODELS || "gemma-4-26b-a4b-it,gemini-3.1-flash-lite,gemini-flash-lite-latest");
const JUDGE_MODELS = modelPool("", process.env.SIM_JUDGE_MODELS || "gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash");
const REASONABLE_AGENT_TURNS = 20;

const CB_BUSINESS = process.env.CALLBACK_WINDOW_BUSINESS_HOURS || "within an hour";
const CB_AFTER = process.env.CALLBACK_WINDOW_AFTER_HOURS || "first thing at ten a.m. when the studio opens. You'll be top of our list";
const SIM_TODAY = "Friday, 9 October 2026";
const APPROVED_TEXTS = [
  process.env.APPROVED_PRICE_BAND_TEXT?.trim() ?? "",
  process.env.APPROVED_PRICE_BAND_TEXT_OFFICE?.trim() ?? "",
];

const OUT_DIR = path.join(process.cwd(), "tests", "output", "simulations", PROMPT_VERSION);

const SIM_AGENT_NOTE = `

# SIMULATION NOTE (test harness only)
This is a text simulation of a phone call. Each of your messages is one spoken turn.
When you end the call, finish your final message with the token [END_CALL].
"(silence)" means the caller said nothing audible.`;

function callerSystem(p: Persona): string {
  return `You are role-playing a person phoning Aangan Studio, an interior design studio in Pune. You are talking to the studio's AI phone assistant.
Stay in character. Speak like a real Pune caller on the phone: short, natural, sometimes incomplete sentences. One or two sentences per turn.
Only reveal information when asked or when it is natural; don't dump everything at once unless your brief says so.
Language: ${p.language}${p.language === "English" ? "" : " (write Hindi in Roman script, like people type it)"}.
If the assistant asks something your brief doesn't cover, improvise plausibly but stay consistent.
When the call is clearly over (the assistant said goodbye, or you would hang up), reply with exactly [HANG_UP].

YOUR BRIEF:
${p.caller}`;
}

interface Turn {
  speaker: "agent" | "caller";
  text: string;
}

async function runDialogue(p: Persona): Promise<{ turns: Turn[]; tokens: number }> {
  const agentSystem =
    renderAgentPrompt(
      {
        isBusinessHours: p.businessHours,
        callbackWindow: p.businessHours ? CB_BUSINESS : CB_AFTER,
        approvedPriceBandText: APPROVED_TEXTS[0],
        approvedPriceBandTextOffice: APPROVED_TEXTS[1],
        callerNumberLast4: p.last4,
        today: SIM_TODAY,
      },
      PROMPT_VERSION,
    ) + SIM_AGENT_NOTE;

  const turns: Turn[] = [];
  let tokens = 0;
  const agentHist: Content[] = [{ role: "user", parts: [{ text: "(call connected)" }] }];
  const callerHist: Content[] = [];

  for (let i = 0; i < MAX_AGENT_TURNS; i++) {
    const a = await generate({ system: agentSystem, contents: agentHist, temperature: 0.4, models: AGENT_MODELS });
    tokens += a.usage.inputTokens + a.usage.outputTokens;
    const agentText = a.text.trim();
    const ended = agentText.includes("[END_CALL]");
    const spoken = agentText.replace("[END_CALL]", "").trim();
    turns.push({ speaker: "agent", text: spoken });
    agentHist.push({ role: "model", parts: [{ text: agentText }] });
    callerHist.push({ role: "user", parts: [{ text: spoken }] });
    if (ended) break;

    const c = await generate({ system: callerSystem(p), contents: callerHist, temperature: 0.8, models: CALLER_MODELS });
    tokens += c.usage.inputTokens + c.usage.outputTokens;
    const callerText = c.text.trim() || "(silence)";
    if (callerText.includes("[HANG_UP]")) {
      const before = callerText.replace("[HANG_UP]", "").trim();
      if (before) turns.push({ speaker: "caller", text: before });
      turns.push({ speaker: "caller", text: "(caller hangs up)" });
      break;
    }
    turns.push({ speaker: "caller", text: callerText });
    callerHist.push({ role: "model", parts: [{ text: callerText }] });
    agentHist.push({ role: "user", parts: [{ text: callerText }] });
  }
  return { turns, tokens };
}

const CRITERIA = [
  ["disclosed_ai_and_recording", "Opening disclosed it is an AI assistant AND that the call is recorded; used the correct greeting variant for business vs after hours; did not open with 'How may I help you'."],
  ["must_have_fields", "If qualifyFlow=true: asked for project type/scope (incl. execution intent when unclear), location, completion timeline, name, and callback number — or accepted 'not given' after at most two tries; never asked about budget. If qualifyFlow=false: correctly did NOT run the full qualification (pass if it collected only what the expected handling allows)."],
  ["one_question_short", "Asked at most one question per turn; each turn short enough to speak (roughly <= 2 sentences / ~35 words, except the opening and closing); never read out a list."],
  ["no_price", "HARD RULE: never stated, confirmed, compared, or reacted to any price, cost, range, rupee/lakh/crore figure, or per-sq-ft rate (including repeating the caller's budget or saying whether it is enough). SOLE EXCEPTION: the APPROVED SENTENCE (if configured) said verbatim, at most once, and only after the caller had already asked about price at least three times; any paraphrase, calculation, or earlier use is a fail."],
  ["no_promises", "Never promised a specific designer/person, a date, a time slot, a site-visit slot, a discount, or a project duration. Only promise: a designer/team will call back within the configured window."],
  ["language_match", "Opened with 'Namaste', then replied in the caller's language (English / Hindi / Hinglish) without announcing a switch."],
  ["edge_case_handled", "Handled this persona's situation as described in EXPECTED HANDLING."],
  ["reasonable_turns", "Finished in a reasonable number of turns for the situation (non-leads quickly; full qualification without dragging), with a one-sentence recap and callback promise when appropriate."],
] as const;

const judgeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    criteria: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, enum: CRITERIA.map((c) => c[0]) },
          pass: { type: Type.BOOLEAN },
          failing_excerpt: { type: Type.STRING, description: "Verbatim agent line(s) that fail; empty if pass" },
          note: { type: Type.STRING },
        },
        required: ["id", "pass", "failing_excerpt", "note"],
      },
    },
  },
  required: ["criteria"],
};

interface CriterionResult {
  id: string;
  pass: boolean;
  failing_excerpt: string;
  note: string;
}

async function judge(p: Persona, turns: Turn[]): Promise<{ results: CriterionResult[]; tokens: number }> {
  const transcript = turns.map((t) => `${t.speaker === "agent" ? "AGENT" : "CALLER"}: ${t.text}`).join("\n");
  const system = `You are a strict QA reviewer for a phone AI assistant at Aangan Studio (interior design, Pune).
Score the AGENT only. Judge each criterion pass/fail. Be strict but fair; quote exact failing agent lines.
Configured callback window: business hours "${CB_BUSINESS}", after hours "${CB_AFTER}". Promising exactly that is allowed.
Saying a designer "will fix a time with you on their call" is NOT a promise of a slot.
Saying pricing depends on the site and that the designer will share an indicative range on their call is the APPROVED price deflection: it is NOT a price and NOT a promise.
Asking carpet area, property status, decision-maker or source is ALLOWED (should-ask fields); only asking about BUDGET is forbidden.
APPROVED SENTENCE(S) for pricing: ${APPROVED_TEXTS.filter(Boolean).map((t) => `"${t}"`).join(" / ") || "(none configured: no figures allowed at all)"}

CRITERIA:
${CRITERIA.map(([id, d]) => `- ${id}: ${d}`).join("\n")}`;
  const user = `PERSONA: ${p.id} (source ${p.source})
business_hours: ${p.businessHours}
caller_language: ${p.language}
caller_id_last4: ${p.last4 || "(withheld)"}
qualifyFlow: ${p.qualifyFlow}
EXPECTED HANDLING: ${p.expected}

TRANSCRIPT:
${transcript}`;
  const r = await generate({
    system,
    contents: user,
    json: { schema: judgeSchema },
    temperature: 0,
    models: JUDGE_MODELS,
  });
  const parsed = JSON.parse(r.text) as { criteria: CriterionResult[] };
  return { results: parsed.criteria, tokens: r.usage.inputTokens + r.usage.outputTokens };
}

interface PersonaReport {
  id: string;
  pass: boolean;
  agentTurns: number;
  tokens: number;
  results: CriterionResult[];
  /** Not run because every model in a pool hit its daily quota. */
  pending?: boolean;
}

async function runPersona(p: Persona): Promise<PersonaReport> {
  const { turns, tokens } = await runDialogue(p);
  const agentTurns = turns.filter((t) => t.speaker === "agent").length;
  const j = await judge(p, turns);

  // Deterministic overrides: price guard (hard fail) and turn cap.
  // The approved sentence is the only allowed figure: strip exact occurrences, then flag the rest.
  // Each extra use beyond the first is left in place and so is caught.
  let approvedUses = 0;
  const priceHits = turns
    .filter((t) => t.speaker === "agent")
    .flatMap((t) => {
      let text = t.text;
      for (const s of APPROVED_TEXTS.filter(Boolean)) {
        if (approvedUses === 0 && text.includes(s)) {
          text = text.replace(s, "");
          approvedUses++;
        }
      }
      return findPriceFigures(text).map((h) => `"${h}" in: ${t.text}`);
    });
  const results = j.results.map((r) => {
    if (r.id === "no_price" && priceHits.length)
      return { ...r, pass: false, failing_excerpt: priceHits.join(" | "), note: "price_guard regex hit (hard fail)" };
    if (r.id === "reasonable_turns" && agentTurns > REASONABLE_AGENT_TURNS)
      return { ...r, pass: false, note: `${agentTurns} agent turns > ${REASONABLE_AGENT_TURNS}` };
    return r;
  });
  for (const [id] of CRITERIA)
    if (!results.some((r) => r.id === id))
      results.push({ id, pass: false, failing_excerpt: "", note: "judge omitted this criterion" });

  const pass = results.every((r) => r.pass);
  const md = [
    `# ${p.id} — ${pass ? "PASS" : "FAIL"}`,
    `source: ${p.source} · business_hours: ${p.businessHours} · language: ${p.language} · prompt: ${PROMPT_VERSION}`,
    "",
    "## Dialogue",
    ...turns.map((t) => `**${t.speaker === "agent" ? "Agent" : "Caller"}:** ${t.text}\n`),
    "## Judge",
    ...results.map((r) => `- ${r.pass ? "✅" : "❌"} **${r.id}**${r.note ? ` — ${r.note}` : ""}${r.failing_excerpt ? `\n  > ${r.failing_excerpt}` : ""}`),
  ].join("\n");
  const report: PersonaReport = { id: p.id, pass, agentTurns, tokens: tokens + j.tokens, results };
  writeFileSync(path.join(OUT_DIR, `${p.id}.md`), md);
  writeFileSync(path.join(OUT_DIR, `${p.id}.json`), JSON.stringify(report, null, 2));
  console.log(`${pass ? "PASS" : "FAIL"}  ${p.id}  (${agentTurns} agent turns)`);
  return report;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const personas = PERSONAS.filter((p) => !ONLY || ONLY.includes(p.id));
  const reports: PersonaReport[] = [];
  const queue: Persona[] = [];
  for (const p of personas) {
    const saved = path.join(OUT_DIR, `${p.id}.json`);
    if (!FORCE && existsSync(saved)) reports.push(JSON.parse(readFileSync(saved, "utf8")));
    else queue.push(p);
  }
  if (reports.length) console.log(`Reusing ${reports.length} saved results (use --force to re-run).`);
  let quotaHit = false;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const p = queue.shift()!;
        try {
          reports.push(await runPersona(p));
        } catch (err) {
          if (err instanceof QuotaExhaustedError) {
            quotaHit = true;
            for (const q of [p, ...queue.splice(0)])
              reports.push({ id: q.id, pass: false, pending: true, agentTurns: 0, tokens: 0, results: [] });
            continue;
          }
          console.error(`ERROR ${p.id}:`, String((err as Error)?.message ?? err).slice(0, 300));
          reports.push({ id: p.id, pass: false, agentTurns: 0, tokens: 0, results: [{ id: "run_error", pass: false, failing_excerpt: "", note: String(err) }] });
        }
      }
    }),
  );
  reports.sort((a, b) => personas.findIndex((p) => p.id === a.id) - personas.findIndex((p) => p.id === b.id));

  const passed = reports.filter((r) => r.pass).length;
  const pending = reports.filter((r) => r.pending).length;
  if (quotaHit) console.error(`Free-tier daily quota exhausted on every model; ${pending} personas left for the next run.`);
  const lines = [
    `# Agent prompt simulation report — ${PROMPT_VERSION}`,
    `Run: ${new Date().toISOString()} · agent models: ${AGENT_MODELS.join(", ")} · ${passed}/${reports.length - pending} run personas passed${pending ? ` · ${pending} pending (quota)` : ""}`,
    "",
    "| Persona | Result | Agent turns | Failed criteria |",
    "|---|---|---|---|",
    ...reports.map((r) => `| [${r.id}](${PROMPT_VERSION}/${r.id}.md) | ${r.pending ? "⏳ pending" : r.pass ? "✅ PASS" : "❌ FAIL"} | ${r.agentTurns} | ${r.results.filter((c) => !c.pass).map((c) => c.id).join(", ")} |`),
    "",
    "## Failing excerpts",
    ...reports.flatMap((r) =>
      r.results.filter((c) => !c.pass).map((c) => `- **${r.id} / ${c.id}**: ${c.note}${c.failing_excerpt ? `\n  > ${c.failing_excerpt}` : ""}`),
    ),
  ];
  writeFileSync(path.join(OUT_DIR, "..", `report_${PROMPT_VERSION}.md`), lines.join("\n"));
  writeFileSync(path.join(OUT_DIR, "..", `report_${PROMPT_VERSION}.json`), JSON.stringify(reports, null, 2));
  console.log(`\n${passed}/${reports.length} passed. Report: tests/output/simulations/report_${PROMPT_VERSION}.md`);
  process.exitCode = passed === reports.length ? 0 : 1;
  if (pending) console.log(`Run again later (quota resets daily) to finish the ${pending} pending personas.`);
}

main();
