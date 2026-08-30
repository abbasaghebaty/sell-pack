import {
  sendMessage,
  getMe,
} from '../api/telegram.js';

import {
  getAccountKeyboard,
} from '../../keyboards/account.js';

import {
  getActivePurchaseByTelegramId,
} from '../database/coursePurchasesQueries.js';

import {
  issueFreshInviteLink,
} from '../services/courseAccessService.js';

import {
  getCoursePlan,
} from '../config/coursePlans.js';

import {
  getWalletBalance,
} from '../services/walletService.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatToman(amount) {
  return Number(
    amount || 0,
  ).toLocaleString('fa-IR');
}

export async function showAccount(
  message,
  env,
  db,
) {
  const botToken =
    env?.TELEGRAM_BOT_TOKEN;

  const walletDb =
    env?.WALLET_DB;

  const telegramUser =
    message?.from;

  if (
    !botToken ||
    !telegramUser?.id
  ) {
    return;
  }

  try {
    const telegramId =
      String(
        telegramUser.id,
      );

    const balance =
      walletDb
        ? await getWalletBalance(
            walletDb,
            telegramId,
          )
        : 0;

    let activePurchase = null;

    if (db) {
      activePurchase =
        await getActivePurchaseByTelegramId(
          db,
          telegramUser.id,
        );
    }

    let subscriptionText =
      'غیرفعال';

    let expiryText =
      'ندارد';

    let inviteLink =
      null;

    if (activePurchase) {
      const plan =
        getCoursePlan(
          activePurchase.course_plan,
        );

      subscriptionText =
        plan?.title ||
        'دائمی';

      expiryText =
        activePurchase.expires_at
          ? new Date(
              activePurchase.expires_at,
            ).toLocaleString(
              'fa-IR',
            )
          : 'بدون تاریخ انقضا';

      if (db) {
        try {
          inviteLink =
            await issueFreshInviteLink(
              db,
              env,
              activePurchase,
            );
        } catch (error) {
          console.warn(
            'Could not create account invite link:',
            error.message,
          );
        }
      }
    }

    let botUsername =
      null;

    try {
      const me =
        await getMe(
          botToken,
        );

      botUsername =
        me?.result?.username ||
        null;
    } catch (error) {
      console.warn(
        'Could not resolve bot username:',
        error.message,
      );
    }

    const referralLink =
      botUsername
        ? `https://t.me/${botUsername}?start=${telegramId}`
        : 'در حال حاضر در دسترس نیست';

    const fullName =
      [
        telegramUser.first_name,
        telegramUser.last_name,
      ]
        .filter(Boolean)
        .join(' ') ||
      'ثبت نشده';

    let text =
      `👤 <b>حساب من</b>\n\n` +
      `نام: <b>${escapeHtml(
        fullName,
      )}</b>\n` +
      `شناسه تلگرام: <code>${escapeHtml(
        telegramId,
      )}</code>\n\n` +
      `💰 موجودی کیف پول: <b>${formatToman(
        balance,
      )} تومان</b>\n\n` +
      `🎁 کد معرف: <code>${escapeHtml(
        telegramId,
      )}</code>\n` +
      `🔗 لینک دعوت:\n${escapeHtml(
        referralLink,
      )}\n\n` +
      `📚 وضعیت اشتراک: <b>${escapeHtml(
        subscriptionText,
      )}</b>\n` +
      `اعتبار تا: <b>${escapeHtml(
        expiryText,
      )}</b>`;

    if (inviteLink) {
      text +=
        `\n\n🔐 <a href="${escapeHtml(
          inviteLink,
        )}">ورود به کانال خصوصی</a>`;
    }

    return sendMessage(
      botToken,
      message.chat.id,
      text,
      getAccountKeyboard(),
    );
  } catch (error) {
    console.error(
      'Account view error:',
      error.message,
      error.stack,
    );

    return sendMessage(
      botToken,
      message.chat.id,
      '❌ دریافت اطلاعات حساب انجام نشد. لطفاً دوباره تلاش کنید.',
      getAccountKeyboard(),
    );
  }
}

export default showAccount;
