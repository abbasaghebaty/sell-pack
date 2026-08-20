/**
 * Command Handler
 *
 * مسیر:
 * src/handlers/commandHandler.js
 *
 * این فایل دستورات دریافت شده را شناسایی و هدایت می‌کند.
 */

import { handleStartCommand } from '../commands/start.js';
import { handleHelpCommand } from '../commands/help.js';
import { sendMessage } from '../api/telegram.js';

export async function handleCommand(message, env, db) {
  try {
    const text = message.text || '';
    const chatId = message.chat.id;
    const botToken = env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      console.error('❌ Bot token not available in command handler');
      return;
    }

    // حذف @ برای دستورات مثل /start@botname
    const command = text.split('@')[0].toLowerCase();

    console.log(`🎯 Command detected: ${command}`);

    switch (command) {
      case '/start':
        // ✅ message.from رو میفرستیم و چک میشه
        return await handleStartCommand(chatId, message.from, env, db);

      case '/help':
        return await handleHelpCommand(chatId, env);

      default:
        console.log(`⚠️ Unknown command: ${command}`);
        // ✅ برای unknown commands پاسخ میدیم
        try {
          return await sendMessage(
            botToken,
            chatId,
            '❓ این دستور شناخته شده نیست\n\nبرای کمک، /help را بزنید',
          );
        } catch (err) {
          console.error('Failed to send unknown command response:', err.message);
        }
        return null;
    }
  } catch (error) {
    console.error('❌ Command handler error:', error.message, error.stack);
    // ✅ اگر خطا بیفتد، سعی میکنیم پیام خطا بفرستیم
    try {
      const chatId = message?.chat?.id;
      const botToken = env?.TELEGRAM_BOT_TOKEN;
      if (chatId && botToken) {
        await sendMessage(
          botToken,
          chatId,
          '😞 متاسفانه خطایی رخ داد. لطفاً بعداً دوباره تلاش کنید.',
        );
      }
    } catch (err) {
      console.error('Failed to send error message:', err.message);
    }
  }
}

export default handleCommand;
