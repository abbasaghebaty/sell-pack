/**
 * User-facing menu screens.
 */

import {
  sendMessage,
  getMe,
  sendPhoto,
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

import {
  buildReferralBannerUrl,
} from '../services/referralBannerService.js';

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

async function getReferralLink(
  message,
  env,
) {
  const botToken =
    env?.TELEGRAM_BOT_TOKEN;

  const telegramId =
    String(message.from.id);

  const me =
    await getMe(botToken);

  const botUsername =
    me?.result?.username;

  if (!botUsername) {
    throw new Error(
      'Telegram bot username is unavailable.',
    );
  }

  return `https://t.me/${botUsername}?start=${telegramId}`;
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
      `با سیستم همکاری EndMark می‌توانید از معرفی دوره درآمد کسب کنید.\n\n` +
      `روش کار ساده است:\n` +
      `۱. لینک دعوت اختصاصی خودتان را برای دیگران ارسال کنید.\n` +
      `۲. فرد معرفی‌شده از طریق لینک شما وارد ربات شود.\n` +
      `۳. اگر همان فرد دوره خریداری کند، <b>۲۰٪ از مبلغ خرید</b> به‌عنوان کمیسیون برای شما در نظر گرفته می‌شود.\n\n` +
      `برای تبلیغ راحت‌تر، می‌توانید بنر اختصاصی خودتان را همراه با لینک دعوت دریافت کنید.`,

    getEarnMoneyKeyboard(),
  );
}

export async function sendReferralBanner(
  message,
  env,
) {
  const botToken =
    env?.TELEGRAM_BOT_TOKEN;

  try {
    const referralLink =
      await getReferralLink(
        message,
        env,
      );

    const bannerUrl =
      buildReferralBannerUrl(
        referralLink,
      );

    return sendPhoto(
      botToken,
      message.chat.id,
      bannerUrl,
      `🖼 <b>بنر اختصاصی شما</b>\n\n` +
        `لینک دعوت شما:\n${escapeHtml(
          referralLink,
        )}\n\n` +
        `این لینک را همراه بنر برای مخاطبان خود ارسال کنید.`,
      getEarnMoneyKeyboard(),
    );
  } catch (error) {
    console.error(
      'Referral banner error:',
      error.message,
      error.stack,
    );

    return sendMessage(
      botToken,
      message.chat.id,
      '❌ دریافت بنر انجام نشد. لطفاً دوباره تلاش کنید.',
      getEarnMoneyKeyboard(),
    );
  }
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
