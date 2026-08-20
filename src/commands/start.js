/**
 * Start Command
 *
 * مسیر:
 * src/commands/start.js
 *
 * این فایل دستور /start را هندل می‌کند.
 */

import { sendMessage } from '../api/telegram.js';
import { getMainMenuKeyboard } from '../../keyboards/mainMenu.js';
import { ensureUser } from '../database/users.js';

export async function handleStartCommand(chatId, telegramUser, env, db) {
  const botToken = env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error('Bot token not available');
    return;
  }

  try {
    console.log(`Start command for user: ${telegramUser.id}`);

    // اگر DB موجود نیست، فقط پیام بفرستیم
    if (db) {
      try {
        const result = await ensureUser(db, telegramUser);
        console.log(`User ensured: ${telegramUser.id}, isNew: ${result.isNew}`);
      } catch (dbError) {
        console.warn('Database error (but continuing):', dbError.message);
      }
    } else {
      console.warn('Database not available');
    }

    const firstName = telegramUser.first_name || 'دوست';
    const welcomeMessage = `سلام <b>${firstName}</b>! 👋\n\nخوش آمدید به آکادمی adminX\n\n🎓 آموزش‌های حرفه‌ای، دسترسی سریع و یادگیری بدون محدودیت.\n\nاز منوی پایین می‌توانید دوره‌ها و امکانات آکادمی را مشاهده کنید.`;

    return sendMessage(
      botToken,
      chatId,
      welcomeMessage,
      getMainMenuKeyboard(),
    );
  } catch (error) {
    console.error('Start command error:', error.message, error.stack);
    try {
      return sendMessage(
        botToken,
        chatId,
        'متاسفانه خطایی رخ داد. لطفاً بعداً دوباره تلاش کنید.',
      );
    } catch (sendError) {
      console.error('Failed to send error message:', sendError);
    }
  }
}

export default handleStartCommand;
