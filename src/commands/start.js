/**
 * Start Command
 *
 * مسیر:
 * src/commands/start.js
 */

import {
  sendMessage,
} from '../api/telegram.js';

import {
  getMainMenuKeyboard,
} from '../../keyboards/mainMenu.js';

import {
  ensureUser,
} from '../database/users.js';

import {
  clearUserState,
} from '../database/userStates.js';

export async function handleStartCommand(
  chatId,
  telegramUser,
  env,
  db
) {
  const botToken =
    env?.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error(
      '❌ Bot token not available'
    );
    return;
  }

  if (!telegramUser?.id) {
    console.error(
      '❌ Telegram user missing'
    );
    return;
  }

  try {
    /*
     * Reset state
     */
    if (db) {
      try {
        await clearUserState(
          db,
          telegramUser.id
        );
      } catch (error) {
        console.error(
          '❌ Failed to clear user state:',
          error.message
        );
      }
    }

    /*
     * Ensure user
     */
    if (db) {
      try {
        const user =
          await ensureUser(
            db,
            telegramUser
          );

        console.log(
          `✅ User ensured: ${telegramUser.id}`,
          `internalId=${user.id}`,
          `isNew=${user.isNew}`
        );

      } catch (error) {
        console.error(
          '❌ Failed to ensure user:',
          error.message
        );
      }
    }

    const firstName =
      escapeHtml(
        telegramUser.first_name ||
        'دوست'
      );

    const welcomeMessage =
      `سلام <b>${firstName}</b>!\n\n` +
      `به <b>آکادمی EndMark</b> خوش آمدید.\n\n` +
      `از منوی زیر می‌توانید دوره‌ها و امکانات آکادمی را مشاهده کنید.`;

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
        'متأسفانه خطایی رخ داد. لطفاً دوباره تلاش کنید.'
      );
    } catch (sendError) {
      console.error(
        '❌ Failed to send error:',
        sendError.message
      );
    }
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default handleStartCommand;
