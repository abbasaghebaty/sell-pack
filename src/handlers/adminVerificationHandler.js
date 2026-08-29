/**
 * Admin verification flow.
 *
 * مسئول این فایل فقط استعلام ادمین است.
 */

import { sendMessage } from '../api/telegram.js';
import {
  COURSE_MENU_BUTTONS,
  getAdminVerificationKeyboard,
} from '../../keyboards/courseMenu.js';
import {
  checkAdminValidity,
  checkAdminValidityByTelegramId,
} from '../database/adminVerifications.js';
import {
  USER_STATES,
  setUserState,
  clearUserState,
} from '../database/userStates.js';
import { showMainMenu, escapeHtml } from './menuHandler.js';

function extractUsername(text) {
  if (!text) return null;
  const value = text.trim();
  if (/^@?[a-zA-Z0-9_]{5,32}$/.test(value)) {
    return value.replace(/^@/, '');
  }
  return null;
}

function extractTelegramId(text) {
  if (!text) return null;
  const value = text.trim();
  if (/^\d{5,15}$/.test(value)) {
    return Number(value);
  }
  return null;
}

async function sendAdminResult({ botToken, chatId, admin, keyboard }) {
  if (admin) {
    return sendMessage(
      botToken,
      chatId,
      `✅ <b>ادمین معتبر است</b>\n\n` +
        `این ادمین توسط <b>EndMark</b> تأیید شده است.\n\n` +
        `👤 ادمین:\n` +
        `<b>@${escapeHtml(admin.username || 'ندارد')}</b>`,
      keyboard,
    );
  }

  return sendMessage(
    botToken,
    chatId,
    `❌ <b>این ادمین معتبر نیست</b>\n\n` +
      `این اطلاعات در فهرست ادمین‌های تأییدشده EndMark پیدا نشد.`,
    keyboard,
  );
}

export async function startAdminVerification(message, env, db) {
  if (!db) {
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      '❌ دیتابیس در دسترس نیست. لطفاً بعداً دوباره تلاش کنید.',
    );
  }

  try {
    await setUserState(
      db,
      message.from.id,
      USER_STATES.WAITING_FOR_ADMIN_VERIFICATION,
      {},
    );
  } catch (error) {
    console.error('Failed to set verification state:', error.message);
    return sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      '❌ در ذخیره وضعیت درخواست مشکلی پیش آمد. لطفاً دوباره تلاش کنید.',
    );
  }

  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    `🔎 <b>استعلام معتبر بودن ادمین</b>\n\n` +
      `یکی از موارد زیر را ارسال کنید:\n\n` +
      `• آیدی عددی ادمین\n` +
      `• یوزرنیم ادمین\n` +
      `• یا یک پیام از طرف همان ادمین را فوروارد کنید.\n\n` +
      `سیستم EndMark پس از دریافت اطلاعات، وضعیت ادمین را بررسی می‌کند.`,
    getAdminVerificationKeyboard(),
  );
}

export async function handleAdminVerificationInput(message, env, db) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text?.trim();

  if (!db) {
    return sendMessage(botToken, chatId, '❌ دیتابیس در دسترس نیست.', getAdminVerificationKeyboard());
  }

  if (text === COURSE_MENU_BUTTONS.BACK) {
    await clearUserState(db, userId);
    return showMainMenu(message, env);
  }

  if (message.forward_origin) {
    const origin = message.forward_origin;

    if (origin.type === 'user' && origin.sender_user) {
      const admin = await checkAdminValidityByTelegramId(db, origin.sender_user.id);
      if (admin) {
        return sendMessage(
          botToken,
          chatId,
          `✅ <b>ادمین معتبر است</b>\n\n` +
            `این ادمین توسط <b>EndMark</b> تأیید شده است.\n\n` +
            `👤 ادمین:\n` +
            `<b>@${escapeHtml(admin.username || 'ندارد')}</b>\n\n` +
            `با اطمینان بیشتری می‌توانید با این ادمین همکاری کنید.`,
          getAdminVerificationKeyboard(),
        );
      }

      return sendMessage(
        botToken,
        chatId,
        `❌ <b>این ادمین تأیید نشده است</b>\n\n` +
          `اطلاعات این ادمین در فهرست ادمین‌های معتبر EndMark پیدا نشد.\n\n` +
          `⚠️ قبل از هرگونه پرداخت، حتماً از معتبر بودن فرد اطمینان حاصل کنید.`,
        getAdminVerificationKeyboard(),
      );
    }

    return sendMessage(
      botToken,
      chatId,
      `⚠️ <b>امکان شناسایی فرستنده اصلی وجود ندارد.</b>\n\n` +
        `لطفاً آیدی عددی یا یوزرنیم ادمین را مستقیم ارسال کنید.`,
      getAdminVerificationKeyboard(),
    );
  }

  const telegramId = extractTelegramId(text);
  if (telegramId) {
    const admin = await checkAdminValidityByTelegramId(db, telegramId);
    return sendAdminResult({
      botToken,
      chatId,
      admin,
      keyboard: getAdminVerificationKeyboard(),
    });
  }

  const username = extractUsername(text);
  if (username) {
    const admin = await checkAdminValidity(db, username);
    return sendAdminResult({
      botToken,
      chatId,
      admin,
      keyboard: getAdminVerificationKeyboard(),
    });
  }

  return sendMessage(
    botToken,
    chatId,
    `❌ <b>فرمت واردشده صحیح نیست.</b>\n\n` +
      `لطفاً یکی از موارد زیر را ارسال کنید:\n\n` +
      `• آیدی عددی ادمین\n` +
      `• یوزرنیم ادمین\n` +
      `• پیام فورواردشده از ادمین`,
    getAdminVerificationKeyboard(),
  );
}

export default {
  startAdminVerification,
  handleAdminVerificationInput,
};
