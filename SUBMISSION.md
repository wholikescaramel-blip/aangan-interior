# Aangan Studio: unanswered enquiries (Case 03 build)

**Live:** https://aangan-interior.vercel.app (dashboard at `/dashboard`) · **Code:** this repo

## The why

| | |
|---|---|
| **Pain** | ~200 enquiries a month. ~48% get no response within 48 hours, and ~33% arrive outside 10am–7pm, when nobody answers. When one does reach a designer, it arrives with no context, so the first call re-asks everything. |
| **User** | The caller (wants an answer now). The designer (wants a ready brief). Nikhil (wants the numbers without pulling them by hand). |
| **Outcome** | Every phone call is answered immediately, day or night. Leads worth a designer's time reach the team with everything already asked. A designer claims each one within the hour. Answering within an hour converts at **4×** the next-day rate. |

**Journey today:** phone rings → answered only 10–7 by 2 people → the message is forwarded without context → the designer re-asks everything → often nobody calls back within 48 hours.
**Journey now:** phone rings → AI assistant answers in seconds (English/Hindi/Hinglish), asks the qualifying questions one at a time → the call ends → Gemini applies Nikhil's rubric → a Telegram card with the full brief reaches the designers' group → the first designer to tap **"I'll take it"** owns it and calls back. The dashboard tracks every step and its cost.

## Components map → what was built

As-built diagram: `docs/aangan_components_map_v2.svg` (original: `aangan_components_map.png`).


| Map box | Built as |
|---|---|
| Caller: calls any hour, English or Hindi | Inbound phone number on **Vaani** |
| Vaani: asks the qualifying questions, never quotes a price | `agent/vaani_prompt_v2.md` (rendered: `agent/rendered/vaani_prompt_v2_universal.md`) |
| Knowledge files: services, qualified, pricing (internal only) | `knowledge/`; the rubric is distilled into `config/qualification_rules.md` (approved v1, with a decision log). **pricing.md is never given to any model.** |
| Vercel backend: receives the call-end webhook, ignores duplicates, saves the call | `app/api/webhooks/vaani` with a shared secret, unique on the call id (`lib/pipeline.ts`) |
| Gemini: reads the transcript, returns status, summary, missing info | `lib/qualify.ts`: JSON schema, zod validation, one retry, then needs_review |
| Neon: stores every call and its verdict | `migrations/`: calls, qualifications, handoffs, errors, … |
| Telegram: qualified and needs-review leads posted with the full summary | `lib/telegram.ts` and `app/api/webhooks/telegram`: one-tap claim, first tap wins (atomic SQL) |
| Dashboard (Nikhil's numbers, including the tool's own cost) | `/dashboard`: time to first response, outcomes, calls by hour, funnel, conversion by claim time, cost per call / month / qualified lead, revenue ÷ cost |

HubSpot and Cal.com, which the map lists as "later", are already coded (`lib/hubspot.ts`, `app/api/webhooks/calcom`). They switch on by adding a token; until then the CRM step is skipped.

## The Cut: quoting per-sq-ft prices
Nikhil asked for the system to *"quote our standard per-square-foot pricing so people don't have to wait for that."* **We did not build it.** pricing.md itself says *"No number from this guide should be quoted to a client"*, and qualified.md says *"Don't quote."* A spoken rate becomes a promise the designer then has to walk back after seeing the site, and the ranges are wide (a standard vs premium kitchen alone can differ 3×, per the front desk in T13). What we did instead:
- The agent deflects warmly, rewording each time. It records that the caller asked about price; Telegram shows "💬 Asked about pricing: yes" so the designer opens with it.
- Hard guards: no price numbers in the prompt, a price-figure detector on every Telegram message and AI summary, and unit tests that fail if a rupee figure or per-sq-ft rate gets through.
- A switch exists (`APPROVED_PRICE_BAND_TEXT`) if Nikhil ever signs off one exact sentence. The studio decided to keep it empty.

## Why Telegram, not email
- **Speed is the metric.** The win is the 1-hour callback (4× conversion). Telegram pushes to every designer's phone instantly; email sits in an inbox.
- **Ownership.** One tap claims the lead, and a second tap gets "Already taken by …". Email can't stop two designers calling the same client, or none of them.
- **Context in one glance.** Name, project, area, timeline, pricing question, summary, missing info, and a transcript link, in a scannable card. The phone number is tap-to-call.
- **The group sees what's unclaimed.** That's where the next phase plugs in an escalation for leads nobody takes.
- Email remains fine as an archive; the CRM (HubSpot, when switched on) is the system of record.

## Results
- **40 September enquiries** run through the Gemini step (`tests/output/qualification_results.csv`): **13 qualified, 18 needs review, 8 not a fit, 1 not a lead.**
  - Every decline cites a rule: Nashik / Talegaon (C2, area), advice-only / restaurant / gym (C1, scope), Diwali in 3 weeks / guests in 3 weeks (C3, timeline), "1–1.5 lakh for kitchen + bedroom" (C4, budget). The existing-client complaint (T09) is correctly "not a lead".
  - Many "needs review" results are calls where the front desk never asked for a name or timeline. The AI agent always asks these, so live calls should land in "qualified" more often.
- **Live end-to-end test** (synthetic call into the production webhook): stored → qualified by Gemini (C1–C5 pass, "asked about pricing" flagged, no figures) → card posted to Telegram in about 20 seconds.
- **Agent simulations:** Gemini plays callers (vague, price-obsessed, Hindi, vendor, existing client, out of scope, rude, refuses number, plus real transcript personas), and an LLM judge scores 8 checks, including a hard fail on any price figure. Report: `tests/output/simulations/report_v2.md`.
- **58 unit tests**: phone normalisation, after-hours, idempotency, the claim race (3 simultaneous taps → 1 winner, against the real database), Telegram format, the no-rupee assertion, Cal.com matching.

## What it costs to run
- **Per call:** Vaani minutes, plus Gemini at about 4.2k input / 1.2k output tokens per qualification (measured over the 40 runs).
- **Fixed:** Neon, Vercel, Telegram and GitHub are all on free plans (₹0). Gemini is currently on the free tier (₹0; about 20 requests per day per model, with automatic fallback across models).
- **Dashboard:** shows cost per call, per month, per qualified lead, and won revenue ÷ cost, from `VAANI_COST_PER_MIN` (or Vaani's reported cost), Gemini token prices and fixed monthly costs.

## How it extends
- **WhatsApp / web form:** a new adapter turns the message or form into the same `Enquiry` object (`lib/enquiry.ts`). Everything downstream (qualification, Telegram, dashboard) already works per channel.
- **Unclaimed-lead escalation, reassignment, designer routing:** see "Next phases" in the README. These were deliberately out of scope for this phase.
