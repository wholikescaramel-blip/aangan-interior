import { readFileSync } from "node:fs";
import path from "node:path";

export const AGENT_PROMPT_VERSION = "v2";

export interface PromptVars {
  isBusinessHours: boolean;
  callbackWindow: string;
  approvedPriceBandText?: string;
  approvedPriceBandTextOffice?: string;
  callerNumberLast4?: string;
  today: string;
}

/** Load agent/vaani_prompt_<version>.md and fill its template variables. */
export function renderAgentPrompt(vars: PromptVars, version = AGENT_PROMPT_VERSION): string {
  const file = path.join(process.cwd(), "agent", `vaani_prompt_${version}.md`);
  return fillPrompt(readFileSync(file, "utf8"), vars);
}

export function fillPrompt(template: string, vars: PromptVars): string {
  const price = vars.approvedPriceBandText?.trim() ?? "";
  const out = template.replace(/<!--[\s\S]*?-->\s*/g, "");
  const map: Record<string, string> = {
    IS_BUSINESS_HOURS: String(vars.isBusinessHours),
    CALLBACK_WINDOW: vars.callbackWindow,
    APPROVED_PRICE_BAND_TEXT: price,
    APPROVED_PRICE_BAND_TEXT_OFFICE: vars.approvedPriceBandTextOffice?.trim() ?? "",
    CALLER_NUMBER_LAST4: vars.callerNumberLast4 ?? "",
    TODAY: vars.today,
  };
  // {{#if VAR}} ... {{else}} ... {{/if}}: VAR is true when non-empty and not "false".
  const truthy = (key: string) => !!map[key] && map[key] !== "false";
  const withIfs = out.replace(
    /\{\{#if ([A-Z0-9_]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
    (_m, key: string, ifPart: string, elsePart = "") => (truthy(key) ? ifPart : elsePart).trim(),
  );
  return withIfs.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, key: string) => (key in map ? map[key] : m));
}

/** Business hours are Monday–Saturday 10:00–19:00 IST; Sunday is closed. */
export function isBusinessHoursIST(d: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "short", hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata",
  }).formatToParts(d);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hourIST = Number(parts.find((p) => p.type === "hour")?.value);
  return weekday !== "Sun" && hourIST >= 10 && hourIST < 19;
}

/**
 * Callback promise for a call at time d. A one-hour promise is only made when the hour fits
 * inside business hours (call before 18:00 IST, Mon–Sat); later calls get the after-hours window.
 */
export function callbackWindowFor(d: Date, env: Record<string, string | undefined> = process.env): string {
  const businessWindow = env.CALLBACK_WINDOW_BUSINESS_HOURS || "within an hour";
  const afterWindow = env.CALLBACK_WINDOW_AFTER_HOURS || "by eleven a.m. on the next working day";
  return isBusinessHoursIST(d) && isBusinessHoursIST(new Date(d.getTime() + 60 * 60 * 1000))
    ? businessWindow
    : afterWindow;
}

export function todayIST(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata",
  }).format(d);
}
