import { sendMessage, sendPhoto, getMe } from "../api/telegram.js";
import { getMainMenuKeyboard } from "../../keyboards/mainMenu.js";
import { getCourseMenuKeyboard } from "../../keyboards/courseMenu.js";
import { getEarnMoneyKeyboard } from "../../keyboards/earnMoney.js";
import { getSupportKeyboard } from "../../keyboards/support.js";
import { buildReferralBannerUrl } from "../services/referralBannerService.js";
import { DEFAULT_COMMISSION_PERCENT, getReferralProfile, getReferralStats } from "../database/referrals.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function normalizeDisplayName(value) {
  const name = String(value ?? "").trim();
  if (!name) return "دوست عزیز";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

let cachedBotUsername = null;

async function getBotUsername(botToken) {
  if (cachedBotUsername) return cachedBotUsername;
  const me = await getMe(botToken);
  const username = me?.result?.username;
  if (!username) throw new Error("Telegram bot username is unavailable.");
  cachedBotUsername = username;
  return username;
}

// Invite code (= the user's numeric Telegram id) and commission percent,
// read from the users table. Falls back to the defaults if the DB is down.
async function loadReferralProfile(message, env) {
  const fallback = { code: String(message.from.id), active: true, percent: DEFAULT_COMMISSION_PERCENT };
  if (!env?.DB) return fallback;
  try {
    return await getReferralProfile(env.DB, message.from.id);
  } catch (error) {
    console.error("Referral profile error:", error.message);
    return fallback;
  }
}

export async function getReferralLink(message, env, profile = null) {
  const username = await getBotUsername(env?.TELEGRAM_BOT_TOKEN);
  const code = profile?.code || message.from.id;
  return `https://t.me/${username}?start=${code}`;
}

export async function showMainMenu(message, env) {
  const firstName = normalizeDisplayName(message.from?.first_name);
  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    `سلام <b>${escapeHtml(firstName)}</b>

به <b>آکادمی EndMark</b> خوش آمدید.

از منوی زیر می‌توانید دوره‌ها و امکانات آکادمی را مشاهده کنید.`,
    getMainMenuKeyboard()
  );
}

export async function showCourseMenu(message, env) {
  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    `🛍 <b>خرید اشتراک</b>

برای تهیه یا تمدید اشتراک، از دکمه «خرید اشتراک» در پایین استفاده کنید.

پس از تأیید پرداخت، اشتراک فقط برای همین حساب تلگرام فعال می‌شود.`,
    getCourseMenuKeyboard()
  );
}

export async function showEarnMoneyMenu(message, env) {
  const profile = await loadReferralProfile(message, env);
  const percentFa = profile.percent.toLocaleString("fa-IR");
  let statsText = "";
  try {
    if (env?.DB) {
      const stats = await getReferralStats(env.DB, message.from.id);
      statsText = `

📊 <b>آمار شما</b>
دعوت‌شدگان: <b>${stats.invited.toLocaleString("fa-IR")} نفر</b>
خریدهای ثبت‌شده: <b>${stats.purchases.toLocaleString("fa-IR")}</b>
مجموع کمیسیون: <b>${stats.totalToman.toLocaleString("fa-IR")} تومان</b>`;
    }
  } catch (error) {
    console.error("Referral stats error:", error.message);
  }

  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    `💰 <b>کسب درآمد با EndMark</b>

با سیستم همکاری EndMark می‌توانید از معرفی دوره درآمد کسب کنید.

روش کار ساده است:
۱. لینک دعوت اختصاصی خودتان را برای دیگران ارسال کنید.
۲. فرد معرفی‌شده باید (به‌عنوان کاربر جدید) از طریق لینک شما وارد ربات شود.
۳. اگر همان فرد دوره را خریداری کند، <b>${percentFa}٪ از مبلغ خرید</b> به‌عنوان کمیسیون به کیف پول شما اضافه می‌شود.

برای تبلیغ راحت‌تر، از دکمه زیر بنر اختصاصی خودتان را دریافت کنید؛ لینک دعوت شما داخل بنر قرار می‌گیرد.${statsText}`,
    getEarnMoneyKeyboard()
  );
}

function buildShareKeyboard(referralLink) {
  const shareText = "با این لینک وارد آکادمی EndMark شو 👇";
  return {
    inline_keyboard: [
      [
        {
          text: "📤 اشتراک‌گذاری لینک",
          url: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`
        }
      ]
    ]
  };
}

export async function sendReferralBanner(message, env) {
  const botToken = env?.TELEGRAM_BOT_TOKEN;
  const chatId = message.chat.id;

  const profile = await loadReferralProfile(message, env);
  const percentFa = profile.percent.toLocaleString("fa-IR");

  let referralLink;
  try {
    referralLink = await getReferralLink(message, env, profile);
  } catch (error) {
    console.error("Referral link error:", error.message, error.stack);
    return sendMessage(
      botToken,
      chatId,
      "❌ دریافت بنر انجام نشد. لطفاً دوباره تلاش کنید.",
      getEarnMoneyKeyboard()
    );
  }

  const caption = `🖼 <b>بنر اختصاصی شما</b>

لینک دعوت شما:
${escapeHtml(referralLink)}

این لینک را همراه بنر برای مخاطبان خود ارسال کنید. به‌ازای خرید هر دعوت‌شده، ${percentFa}٪ کمیسیون به کیف پول شما اضافه می‌شود.`;
  const keyboard = buildShareKeyboard(referralLink);

  try {
    return await sendPhoto(botToken, chatId, buildReferralBannerUrl(referralLink, profile.percent), caption, keyboard);
  } catch (error) {
    // If the image service is down the user still gets a working link.
    console.error("Referral banner photo failed:", error.message);
    return sendMessage(botToken, chatId, caption, keyboard);
  }
}

export async function showSupportMenu(message, env) {
  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    `🛟 <b>راهنما و پشتیبانی EndMark</b>

اگر در خرید دوره، پرداخت، استفاده از ربات یا هر بخش دیگری از خدمات EndMark مشکلی دارید، می‌توانید از راه‌های زیر با ما در ارتباط باشید.

📩 <b>پشتیبانی مستقیم:</b>
برای ارتباط مستقیم با پشتیبانی، از دکمه زیر استفاده کنید.

🤖 <b>ربات دستیار:</b>
برای دریافت راهنمایی و استفاده از امکانات کمکی، می‌توانید وارد ربات دستیار EndMark شوید.

🕶 <b>پیام ناشناس:</b>
اگر ترجیح می‌دهید پیام خود را به‌صورت ناشناس ارسال کنید، از گزینه پیام ناشناس استفاده کنید.

قبل از ارسال مشکل، در صورت امکان توضیح کامل و دقیق مشکل خود را ارسال کنید تا بررسی سریع‌تر انجام شود.`,
    getSupportKeyboard()
  );
}
