/**
 * Message Handler
 *
 * مسیر:
 * src/handlers/messageHandler.js
 *
 * این فایل پیام‌های عادی و کلیک‌های دکمه را پردازش می‌کند.
 */

import { sendMessage } from '../api/telegram.js';
import {
  MAIN_MENU_BUTTONS,
  getMainMenuKeyboard,
} from '../../keyboards/mainMenu.js';

export async function handleMessage(message, env, db) {
  try {
    const text = message.text || '';
    const chatId = message.chat.id;
    const botToken = env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      console.error('❌ Bot token not available in handleMessage');
      return;
    }

    if (!chatId) {
      console.error('❌ Chat ID not available');
      return;
    }

    console.log(`💬 Handling message: "${text}"`);

    // ✅ اینجا await استفاده میکنیم
    switch (text) {
      case MAIN_MENU_BUTTONS.BUY_COURSE:
        return await sendMessage(
          botToken,
          chatId,
          '🛒 <b>دوره‌های موجود برای خرید:</b>\n\n<i>(بزودی)</i>',
        );

      case MAIN_MENU_BUTTONS.MY_COURSES:
        return await sendMessage(
          botToken,
          chatId,
          '📚 <b>دوره‌های شما:</b>\n\n<i>(بزودی)</i>',
        );

      case MAIN_MENU_BUTTONS.EARN_MONEY:
        return await sendMessage(
          botToken,
          chatId,
          '💰 <b>برنامه کسب درآمد:</b>\n\n<i>(بزودی)</i>',
        );

      case MAIN_MENU_BUTTONS.ACCOUNT:
        return await sendMessage(
          botToken,
          chatId,
          '👤 <b>حساب کاربری:</b>\n\n<i>(بزودی)</i>',
        );

      case MAIN_MENU_BUTTONS.SUPPORT:
        return await sendMessage(
          botToken,
          chatId,
          '❓ <b>راهنما و پشتیبانی:</b>\n\n<i>(بزودی)</i>',
        );

      default:
        console.log(`⚠️ Unknown message: "${text}"`);
        return await sendMessage(
          botToken,
          chatId,
          '🤔 متوجه نشدم! لطفاً از منوی زیر استفاده کنید.',
          getMainMenuKeyboard(),
        );
    }
  } catch (error) {
    console.error('❌ Error in handleMessage:', error.message, error.stack);
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

export default handleMessage;
