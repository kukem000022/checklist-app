import { config } from "./config.js";

export async function sendTelegramMessage(chatId, text) {
  if (!config.telegramBotToken) {
    return { ok: false, skipped: true, description: "Missing TELEGRAM_BOT_TOKEN" };
  }

  if (!chatId) {
    return { ok: false, skipped: true, description: "Missing telegram chat id" };
  }

  const response = await fetch(
    `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    },
  );

  return response.json();
}

export async function getTelegramUpdates() {
  if (!config.telegramBotToken) {
    return { ok: false, description: "Missing TELEGRAM_BOT_TOKEN" };
  }

  const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/getUpdates`);
  return response.json();
}

export async function getTelegramChatIds() {
  const updates = await getTelegramUpdates();
  if (!updates.ok) return updates;

  const chats = new Map();
  for (const update of updates.result || []) {
    const message = update.message || update.edited_message || update.channel_post;
    const chat = message?.chat;
    if (!chat?.id) continue;

    chats.set(String(chat.id), {
      chat_id: String(chat.id),
      type: chat.type,
      name: [chat.first_name, chat.last_name].filter(Boolean).join(" ") || chat.title || chat.username || "Telegram user",
      username: chat.username || "",
      text: message.text || "",
      date: message.date ? new Date(message.date * 1000).toISOString() : null,
    });
  }

  return { ok: true, result: [...chats.values()].reverse() };
}
