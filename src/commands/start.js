/**
 * Start Command
 *
 * مسیر:
 * src/commands/start.js
 *
 * مسئول:
 * - ثبت / بروزرسانی کاربر
 * - پاک کردن State قبلی
 * - نمایش منوی اصلی
 */

import { sendMessage } from '../api/telegram.js';
import { getMainMenuKeyboard } from '../../keyboards/mainMenu.js';
import { ensureUser } from '../database/users.js';
import { clearUserState } from '../database/userStates.js';

export async function handleStartCommand(
  chatId,
  telegramUser,
  env,
  db
) {
  const botToken = env?.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error('❌ Bot token not available');
    return;
  }

  if (!telegramUser?.id) {
    console.error('❌ Telegram user information is missing');
    return;
  }

  try {
    console.log(`▶️ Start command for user: ${telegramUser.id}`);

    /*
     * پاک کردن State قبلی
     */
    if (db) {
      try {
        await clearUserState(
          db,
          telegramUser.id
        );
      } catch (stateError) {
        console.warn(
          '⚠️ Failed to clear user state:',
          stateError.message
        );
      }
    }

    /*
     * ایجاد / بروزرسانی کاربر
     */
    if (db) {
      try {
        const result = await ensureUser(
          db,
          telegramUser
        );

        console.log(
          `✅ User ensured: ${telegramUser.id}`,
          `internalId=${result.id}`,
          `isNew=${result.isNew}`
        );
      } catch (dbError) {
        console.error(
          '❌ Database error in start:',
          dbError.message
        );
      }
    } else {
      console.warn('⚠️ Database not available');
    }

    const firstName =
      telegramUser.first_name || 'دوست';

    const welcomeMessage =
      `سلام <b>${escapeHtml(firstName)}</b>!\n\n` +
      `به <b>آکادمی AdminX</b> خوش آمدید.\n\n` +
      `از منوی پایین می‌توانید دوره‌ها و امکانات آکادمی را مشاهده کنید.`;

    return await sendMessage(
      botToken,
      chatId,
      welcomeMessage,
      getMainMenuKeyboard()
    );

  } catch (error) {
    console.error(
      '❌ Start command error:',
      error.message,
      error.stack
    );

    try {
      return await sendMessage(
        botToken,
        chatId,
        'متأسفانه خطایی رخ داد. لطفاً بعداً دوباره تلاش کنید.'
      );
    } catch (sendError) {
      console.error(
        '❌ Failed to send start error:',
        sendError.message
      );
    }
  }
}

/**
 * جلوگیری از خراب شدن HTML پیام
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default handleStartCommand;
