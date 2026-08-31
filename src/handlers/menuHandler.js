/**
 * User-facing menu screens.
 */

import {
  sendMessage,
} from '../api/telegram.js';

import {
  getMainMenuKeyboard,
} from '../../keyboards/mainMenu.js';

import {
  getCourseMenuKeyboard,
} from '../../keyboards/courseMenu.js';

import {
  getEarnMoneyKeyboard,
} from '../../keyboards/earnMoney.js';

import {
  getSupportKeyboard,
} from '../../keyboards/support.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeDisplayName(
  value,
) {
  const name =
    String(value ?? '').trim();

  if (!name) {
    return 'دوست عزیز';
  }

  return (
    name.charAt(0).toUpperCase() +
    name.slice(1)
  );
}

export async function showMainMenu(
  message,
  env,
) {
  const firstName =
    normalizeDisplayName(
      message.from?.first_name,
    );

  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,

    `سلام <b>${escapeHtml(
      firstName,
    )}</b>\n\n` +

      `به <b>آکادمی EndMark</b> خوش آمدید.\n\n` +

      `از منوی زیر می‌توانید دوره‌ها و امکانات آکادمی را مشاهده کنید.`,

    getMainMenuKeyboard(),
  );
}

export async function showCourseMenu(
  message,
  env,
) {
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

export async function showEarnMoneyMenu(
  message,
  env,
) {
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

export async function showSupportMenu(
  message,
  env,
) {
  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,

    `🛟 <b>راهنما و پشتیبانی EndMark</b>\n\n` +

      `اگر در خرید دوره، پرداخت، استفاده از ربات یا هر بخش دیگری از خدمات EndMark مشکلی دارید، می‌توانید از راه‌های زیر با ما در ارتباط باشید.\n\n` +

      `📩 <b>پشتیبانی مستقیم:</b>\n` +
      `برای ارتباط مستقیم با پشتیبانی، از دکمه زیر استفاده کنید.\n\n` +

      `🤖 <b>ربات دستیار:</b>\n` +
      `برای دریافت راهنمایی و استفاده از امکانات کمکی، می‌توانید وارد ربات دستیار EndMark شوید.\n\n` +

      `🕶 <b>پیام ناشناس:</b>\n` +
      `اگر ترجیح می‌دهید پیام خود را به‌صورت ناشناس ارسال کنید، از گزینه پیام ناشناس استفاده کنید.\n\n` +

      `قبل از ارسال مشکل، در صورت امکان توضیح کامل و دقیق مشکل خود را ارسال کنید تا بررسی سریع‌تر انجام شود.`,

    getSupportKeyboard(),
  );
}
