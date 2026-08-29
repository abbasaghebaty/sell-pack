/**
 * Start command.
 */

import { sendMessage } from '../api/telegram.js';
import { showMainMenu } from '../handlers/menuHandler.js';
import { ensureUser } from '../database/users.js';
import { clearUserState } from '../database/userStates.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function handleStartCommand(chatId, telegramUser, env, db) {
  const botToken = env?.TELEGRAM_BOT_TOKEN;

  if (!botToken || !telegramUser?.id) {
    console.error('Start command prerequisites missing');
    return;
  }

  try {
    if (db) {
      try {
        await clearUserState(db, telegramUser.id);
      } catch (error) {
        console.error('Failed to clear user state:', error.message);
      }

      try {
        const user = await ensureUser(db, telegramUser);
        console.log(`User ensured: ${telegramUser.id}`, `internalId=${user.id}`, `isNew=${user.isNew}`);
      } catch (error) {
        console.error('Failed to ensure user:', error.message);
      }
    }

    return showMainMenu(
      {
        chat: { id: chatId },
        from: telegramUser,
      },
      env,
    );
  } catch (error) {
    console.error('Start command error:', error.message, error.stack);
    try {
      return await sendMessage(
        botToken,
        chatId,
        'متأسفانه خطایی رخ داد. لطفاً دوباره تلاش کنید.',
      );
    } catch (sendError) {
      console.error('Failed to send error:', sendError.message);
    }
  }
}

export default handleStartCommand;
