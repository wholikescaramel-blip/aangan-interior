/**
 * Renders the agent prompt into ready-to-paste files for the Vaani dashboard, in case Vaani can't fill
 * variables per call:
 *   agent/rendered/vaani_prompt_<v>_business_hours.md and _after_hours.md
 * Caller-number confirmation then uses the generic "best number" question.
 *   npm run render-prompt [-- v2]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderAgentPrompt, AGENT_PROMPT_VERSION } from "../lib/prompt";

const version = process.argv[2] ?? AGENT_PROMPT_VERSION;
const dir = path.join(process.cwd(), "agent", "rendered");
mkdirSync(dir, { recursive: true });
// "universal": one prompt for any time of day, for when Vaani cannot switch prompts by time.
const UNIVERSAL_WINDOW = "within the hour, or, if we're closed right now, first thing at ten a.m. when the studio opens. You'll be top of our list";
for (const [name, isBusinessHours] of [["business_hours", true], ["after_hours", false], ["universal", true]] as const) {
  const text = renderAgentPrompt(
    {
      isBusinessHours,
      callbackWindow: name === "universal" ? UNIVERSAL_WINDOW : isBusinessHours
        ? process.env.CALLBACK_WINDOW_BUSINESS_HOURS || "within an hour"
        : process.env.CALLBACK_WINDOW_AFTER_HOURS || "first thing at ten a.m. when the studio opens. You'll be top of our list",
      approvedPriceBandText: process.env.APPROVED_PRICE_BAND_TEXT,
      approvedPriceBandTextOffice: process.env.APPROVED_PRICE_BAND_TEXT_OFFICE,
      callerNumberLast4: "",
      today: "(today's date)",
    },
    version,
  ).replace(/Today is \(today's date\)\.\n?/, "");
  const file = path.join(dir, `vaani_prompt_${version}_${name}.md`);
  writeFileSync(file, text);
  console.log("wrote", path.relative(process.cwd(), file));
}
