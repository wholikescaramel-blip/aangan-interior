/**
 * Telegram handoff: lead cards with one claim button. No price figure may ever appear in a message:
 * every free-text field is redacted by the price guard and the final text is asserted clean.
 */
import { containsPriceFigure } from "./price_guard";
import type { Qualification } from "./qualify";
import { isDryRun } from "./env";

export const CLAIM_PREFIX = "claim:";

export async function tg(method: string, body: unknown, token = process.env.TELEGRAM_BOT_TOKEN): Promise<any> {
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Telegram ${method} failed: ${json.description ?? res.status}`);
  return json.result;
}

/** Where lead cards go: the designers' group, or the admin chat in DRY_RUN. */
export function leadChatId(): string {
  const id = isDryRun() ? process.env.TELEGRAM_ADMIN_CHAT_ID : process.env.TELEGRAM_CHAT_ID;
  if (!id) throw new Error(isDryRun() ? "TELEGRAM_ADMIN_CHAT_ID is not set" : "TELEGRAM_CHAT_ID is not set");
  return id;
}

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Free text from the caller/model: drop it entirely if it contains a money figure. */
const safe = (s: string | null | undefined, fallback = "—") => {
  if (!s) return fallback;
  return containsPriceFigure(s) ? "[removed]" : esc(s);
};

export function formatIST(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  }).format(d) + " IST";
}

export interface LeadCard {
  q: Qualification;
  phone: string | null;
  callTime: Date;
  afterHours: boolean;
  links: { deal: string | null; transcript: string | null; recording: string | null; booking: string | null };
  dryRun?: boolean;
}

export function formatLeadMessage(c: LeadCard): string {
  const { q } = c;
  const k = q.collected;
  const head = q.status === "qualified" ? "🟢 <b>QUALIFIED</b>" : "🟡 <b>NEEDS REVIEW</b>";
  const area = k.carpet_area_sqft ? `${Math.round(k.carpet_area_sqft).toLocaleString("en-IN")} sq ft` : "area —";
  const phone = c.phone ?? k.phone;
  const summaryLines = q.summary.split(/\n+/).map((l) => l.trim()).filter(Boolean).slice(0, 5);
  const links = [
    c.links.deal && `<a href="${esc(c.links.deal)}">HubSpot deal</a>`,
    c.links.transcript && `<a href="${esc(c.links.transcript)}">Transcript</a>`,
    c.links.recording && `<a href="${esc(c.links.recording)}">Recording</a>`,
    c.links.booking && `<a href="${esc(c.links.booking)}">Booking link</a>`,
  ].filter(Boolean);

  const lines = [
    (c.dryRun ? "🧪 <i>[DRY RUN]</i>\n" : "") + head,
    `<b>${safe(k.name, "Name not given")}</b> · ${phone ? esc(phone) : "no number"}`,
    `Project: ${[safe(k.project_type), safe(k.scope), area, safe(k.location), safe(k.property_status)].join(" · ")}`,
    `Budget: ${k.budget ? "mentioned by caller" : "not mentioned"} · Timeline: ${safe(k.timeline)} · Heard of us via: ${safe(k.source)}`,
    `💬 Asked about pricing: ${k.asked_about_pricing ? "yes" : "no"}`,
    "",
    ...summaryLines.map((l) => safe(l)),
    ...(q.missing_info.length ? ["", `Missing: ${q.missing_info.map((m) => safe(m)).join(", ")}`] : []),
    "",
    links.length ? `🔗 ${links.join(" · ")}` : "",
    `📞 ${formatIST(c.callTime)}${c.afterHours ? " · after hours" : ""}`,
  ];
  const text = lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n").trim();
  assertNoPrice(text);
  return text;
}

export function assertNoPrice(text: string): void {
  // Links are excluded from the check (URLs can contain arbitrary characters).
  if (containsPriceFigure(text.replace(/<a href="[^"]*">/g, ""))) throw new Error("Refusing to send: message contains a price figure");
}

export const claimKeyboard = (callId: string) => ({
  inline_keyboard: [[{ text: "✅ I'll take it", callback_data: CLAIM_PREFIX + callId }]],
});

export function takenLine(name: string, at: Date): string {
  return `\n\n✅ <b>Taken by ${esc(name)}</b> at ${formatIST(at)}`;
}

export function displayName(u: { first_name?: string; last_name?: string; username?: string }): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || (u.username ? "@" + u.username : "someone");
}

export async function postNote(text: string, chatId = leadChatId()): Promise<void> {
  assertNoPrice(text);
  await tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true });
}
