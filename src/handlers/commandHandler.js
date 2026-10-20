import { sendMessage } from "../api/telegram.js";
import { handleStartCommand } from "../commands/start.js";
import { handleHelpCommand } from "../commands/help.js";

export async function handleCommand(message, env, db) {
  try {
    const text = (message.text || "").trim();
    const chatId = message.chat.id;
    const botToken = env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error("Bot token not available in command handler");
      return;
    }

    // "/start 123456789" (referral deep link) must still match "/start".
    const [rawCommand = "", ...args] = text.split(/\s+/);
    const command = rawCommand.split("@")[0].toLowerCase();
    const payload = args.join(" ");

    switch (command) {
      case "/start":
        return await handleStartCommand(chatId, message.from, env, db, payload);
      case "/help":
        return await handleHelpCommand(chatId, env);
      default:
        try {
          return await sendMessage(
            botToken,
            chatId,
            "❓ این دستور شناخته شده نیست\n\nبرای کمک، /help را بزنید"
          );
        } catch (err) {
          console.error("Failed to send unknown command response:", err.message);
        }
        return null;
    }
  } catch (error) {
    console.error("Command handler error:", error.message, error.stack);
    try {
      const chatId = message?.chat?.id;
      const botToken = env?.TELEGRAM_BOT_TOKEN;
      if (chatId && botToken) {
        await sendMessage(botToken, chatId, "😞 متاسفانه خطایی رخ داد. لطفاً بعداً دوباره تلاش کنید.");
      }
    } catch (err) {
      console.error("Failed to send error message:", err.message);
    }
  }
}

export default handleCommand;
