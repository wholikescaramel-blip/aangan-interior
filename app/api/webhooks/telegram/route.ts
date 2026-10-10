import { after } from "next/server";
import { safeEqual } from "@/lib/vaani";
import { claimLead } from "@/lib/claim";
import { CLAIM_PREFIX, displayName, formatIST, leadChatId, takenLine, tg } from "@/lib/telegram";
import { HubSpot } from "@/lib/hubspot";
import { sql, logError } from "@/lib/db";

export const maxDuration = 30;

const MEMBER_STATUSES = new Set(["creator", "administrator", "member", "restricted"]);

export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const got = req.headers.get("x-telegram-bot-api-secret-token");
  if (!secret || !got || !safeEqual(got, secret)) return new Response("unauthorized", { status: 401 });

  const update = await req.json();

  // Setup helper: "/chatid" in any chat the bot is in replies with that chat's id.
  const text: string | undefined = update.message?.text;
  if (text && /^\/chatid(@\w+)?$/.test(text.trim())) {
    await tg("sendMessage", { chat_id: update.message.chat.id, text: `Chat id: ${update.message.chat.id}` });
    return Response.json({ ok: true });
  }

  const cq = update.callback_query;
  if (!cq?.data?.startsWith(CLAIM_PREFIX)) return Response.json({ ok: true });
  const callId = cq.data.slice(CLAIM_PREFIX.length);
  const chatId = String(cq.message?.chat?.id ?? "");
  const answer = (t: string) => tg("answerCallbackQuery", { callback_query_id: cq.id, text: t });

  // Only taps from members of the lead chat count.
  let isMember = false;
  try {
    if (chatId === leadChatId()) {
      const m = await tg("getChatMember", { chat_id: chatId, user_id: cq.from.id });
      isMember = MEMBER_STATUSES.has(m.status);
    }
  } catch (err) {
    await logError("telegram", "membership check failed", { err: String(err) }, callId);
  }
  if (!isMember) {
    await answer("Only the designers' group can claim leads.");
    return Response.json({ ok: true });
  }

  const name = displayName(cq.from);
  const result = await claimLead(callId, { id: cq.from.id, name });
  if (!result.ok) {
    await answer(result.reason === "already_taken" ? `Already taken by ${result.by}` : "Lead not found.");
    return Response.json({ ok: true });
  }

  await answer("It's yours! Call them and send the booking link.");
  // Edit the card: append the claim line and remove the button.
  const original: string = cq.message?.text ?? "";
  try {
    await tg("editMessageText", {
      chat_id: chatId,
      message_id: cq.message.message_id,
      text: escapeForEdit(cq.message) + takenLine(name, result.claimedAt),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [] },
    });
  } catch (err) {
    await logError("telegram", "editMessageText failed", { err: String(err), original: original.slice(0, 200) }, callId);
  }

  after(async () => {
    try {
      const row = ((await sql()`SELECT deal_id FROM hubspot_sync WHERE call_id = ${callId}`) as any[])[0];
      if (row?.deal_id) {
        const stage = process.env.HUBSPOT_STAGE_DESIGNER_CONTACTED;
        await new HubSpot().updateDeal(row.deal_id, { assigned_designer: name, ...(stage ? { dealstage: stage } : {}) });
        if (stage) await sql()`UPDATE hubspot_sync SET deal_stage = ${stage}, updated_at = now() WHERE call_id = ${callId}`;
      }
    } catch (err) {
      await logError("hubspot", `claim sync failed: ${String((err as Error).message ?? err)}`, { claimedBy: name, at: formatIST(result.claimedAt) }, callId);
    }
  });
  return Response.json({ ok: true });
}

/**
 * Rebuild the message as HTML from Telegram's plain text + entities, so bold text and links
 * survive the edit.
 */
function escapeForEdit(message: { text?: string; entities?: Array<{ type: string; offset: number; length: number; url?: string }> }): string {
  const text = message.text ?? "";
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const ents = [...(message.entities ?? [])].filter((e) => ["bold", "italic", "text_link"].includes(e.type)).sort((a, b) => a.offset - b.offset);
  // Offsets are UTF-16 code units, which is how JS strings index.
  let out = "";
  let pos = 0;
  for (const e of ents) {
    if (e.offset < pos) continue; // skip overlapping entities
    out += esc(text.slice(pos, e.offset));
    const inner = esc(text.slice(e.offset, e.offset + e.length));
    out += e.type === "bold" ? `<b>${inner}</b>` : e.type === "italic" ? `<i>${inner}</i>` : `<a href="${esc(e.url ?? "")}">${inner}</a>`;
    pos = e.offset + e.length;
  }
  return out + esc(text.slice(pos));
}
