/**
 * User-facing menu screens.
 *
 * این فایل فقط متن/کیبورد منوها را مدیریت می‌کند.
 */

import { sendMessage } from '../api/telegram.js';
import { getMainMenuKeyboard } from '../../keyboards/mainMenu.js';
import { getCourseMenuKeyboard } from '../../keyboards/courseMenu.js';
import { getEarnMoneyKeyboard } from '../../keyboards/earnMoney.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function showMainMenu(message, env) {
  const firstName = escapeHtml(message.from?.first_name || 'دوست عزیز');

  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    `سلام <b>${firstName}</b>\n\n` +
      `به <b>آکادمی EndMark</b> خوش آمدید.\n\n` +
      `از منوی زیر می‌توانید دوره‌ها و امکانات آکادمی را مشاهده کنید.`,
    getMainMenuKeyboard(),
  );
}

export async function showCourseMenu(message, env) {
  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    `🛍 <b>خرید دوره</b>\n\n` +
      `قبل از هرگونه خرید یا پرداخت، ابتدا از معتبر بودن ادمینی که قصد همکاری با او را دارید مطمئن شوید.\n\n` +
      `برای جلوگیری از همکاری با افراد جعلی، می‌توانید اطلاعات ادمین را از طریق سیستم <b>EndMark</b> استعلام بگیرید.\n\n` +
      `🔎 از دکمه زیر برای استعلام ادمین استفاده کنید.`,
    getCourseMenuKeyboard(),
  );
}

export async function showEarnMoneyMenu(message, env) {
  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    `💰 <b>کسب درآمد با EndMark</b>\n\n` +
      `اگر قصد دارید به عنوان ادمین با EndMark همکاری کنید، می‌توانید درخواست ثبت حساب ادمینی خود را ارسال کنید.\n\n` +
      `برای ثبت درخواست همکاری، ابتدا باید دوره آموزشی را خریداری کرده باشید.\n\n` +
      `پس از ارسال درخواست، اطلاعات شما توسط تیم EndMark بررسی خواهد شد.\n\n` +
      `برای شروع، گزینه زیر را انتخاب کنید.`,
    getEarnMoneyKeyboard(),
  );
}

export async function showSupportMenu(message, env) {
  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    `❓ <b>راهنما و پشتیبانی</b>\n\n` +
      `برای دریافت راهنمایی و پشتیبانی، با تیم EndMark در ارتباط باشید.`,
    getMainMenuKeyboard(),
  );
}
