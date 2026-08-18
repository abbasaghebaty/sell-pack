/**
 * Start Command
 *
 * مسیر:
 * src/commands/start.js
 *
 * این فایل دستور /start را هندل می‌کند.
 */

import { sendMessage } from '../api/telegram.js';
import getMainMenuKeyboard from '../../keyboards/mainMenu.js';
import { ensureUser } from '../database/users.js';

export async function handleStartCommand(chatId, telegramUser, env, db) {
  const botToken = env.TELEGRAM_BOT_TOKEN;

  try {
    // اطمینان از وجود کاربر در دیتابیس
    const result = await ensureUser(db, telegramUser);

    const firstName = telegramUser.first_name || 'دوست';
    const welcomeMessage = result.isNew
      ? `سلام <b>${firstName}</b>! 👋\n\nخوش آمدید به فروشگاه دوره‌های آنلاین! 🎓`
      : `خوش برگشتی <b>${firstName}</b>! 👋`;

    return sendMessage(
      botToken,
      chatId,
      welcomeMessage,
      getMainMenuKeyboard(),
    );
  } catch (error) {
    console.error('Start command error:', error);
    return sendMessage(
      botToken,
      chatId,
      'متاسفانه خطایی رخ داد. لطفاً بعداً دوباره تلاش کنید.',
    );
  }
}

export default handleStartCommand;
