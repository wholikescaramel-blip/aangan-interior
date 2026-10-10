/**
 * Telegram setup.
 *   npm run telegram-setup -- chats     # before the webhook is set: lists chats the bot has seen (send any message in the group first)
 *   npm run telegram-setup -- webhook   # points the bot at APP_BASE_URL/api/webhooks/telegram with TELEGRAM_WEBHOOK_SECRET
 *   npm run telegram-setup -- info      # shows the current webhook status
 */
import { tg } from "../lib/telegram";

async function main() {
  const cmd = process.argv[2] ?? "info";
  if (cmd === "chats") {
    const updates = await tg("getUpdates", { allowed_updates: ["message", "my_chat_member"] });
    const chats = new Map<string, string>();
    for (const u of updates) {
      const chat = u.message?.chat ?? u.my_chat_member?.chat;
      if (chat) chats.set(String(chat.id), `${chat.type}: ${chat.title ?? [chat.first_name, chat.last_name].filter(Boolean).join(" ")}`);
    }
    if (!chats.size) console.log("No chats yet. Add the bot to the group, send a message there (and DM the bot), then re-run.");
    for (const [id, label] of chats) console.log(`${id.padEnd(16)} ${label}`);
    console.log("\nGroup id -> TELEGRAM_CHAT_ID (negative number). Your private chat id -> TELEGRAM_ADMIN_CHAT_ID.");
    return;
  }
  if (cmd === "webhook") {
    const base = process.env.APP_BASE_URL;
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!base || !secret) throw new Error("Set APP_BASE_URL and TELEGRAM_WEBHOOK_SECRET in .env first");
    await tg("setWebhook", {
      url: `${base.replace(/\/$/, "")}/api/webhooks/telegram`,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    });
    console.log("Webhook set.");
  }
  console.log(await tg("getWebhookInfo", {}));
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
