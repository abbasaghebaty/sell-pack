/**
 * Message Handler
 *
 * مسیر:
 * src/handlers/messageHandler.js
 *
 * این فایل پیام‌های عادی و کلیک‌های دکمه را پردازش می‌کند.
 */

import { sendMessage } from '../api/telegram.js';
import { MAIN_MENU_BUTTONS } from '../../keyboards/mainMenu.js';
import getMainMenuKeyboard from '../../keyboards/mainMenu.js';

export async function handleMessage(message, env, db) {
  const text = message.text || '';
  const chatId = message.chat.id;
  const botToken = env.TELEGRAM_BOT_TOKEN;

  switch (text) {
    case MAIN_MENU_BUTTONS.BUY_COURSE:
      return sendMessage(
        botToken,
        chatId,
        '🛒 دوره‌های موجود برای خرید:\n\n(بزودی)',
      );

    case MAIN_MENU_BUTTONS.MY_COURSES:
      return sendMessage(
        botToken,
        chatId,
        '📚 دوره‌های شما:\n\n(بزودی)',
      );

    case MAIN_MENU_BUTTONS.EARN_MONEY:
      return sendMessage(
        botToken,
        chatId,
        '💰 برنامه کسب درآمد:\n\n(بزودی)',
      );

    case MAIN_MENU_BUTTONS.ACCOUNT:
      return sendMessage(
        botToken,
        chatId,
        '👤 حساب کاربری:\n\n(بزودی)',
      );

    case MAIN_MENU_BUTTONS.SUPPORT:
      return sendMessage(
        botToken,
        chatId,
        '❓ راهنما و پشتیبانی:\n\n(بزودی)',
      );

    default:
      return sendMessage(
        botToken,
        chatId,
        'متوجه نشدم! لطفاً از منوی زیر استفاده کنید.',
        getMainMenuKeyboard(),
      );
  }
}

export default handleMessage;
