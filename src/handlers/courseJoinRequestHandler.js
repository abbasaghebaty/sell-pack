import {
  approveChatJoinRequest,
  declineChatJoinRequest,
  revokeChatInviteLink,
  sendMessage,
} from '../api/telegram.js';

import {
  getActivePurchaseByTelegramId,
  getPurchaseByInviteLink,
} from '../database/coursePurchasesQueries.js';

import {
  getActiveCourseBuyer,
} from '../database/courseBuyers.js';

import {
  clearPurchaseInviteLink,
  markPurchaseJoined,
} from '../database/purchaseInvites.js';

import {
  sendAccessLink,
  COURSE_CHANNEL_ID,
} from '../services/courseAccessService.js';

function getChannelId(env) {
  return String(
    env?.COURSE_CHANNEL_ID ||
      COURSE_CHANNEL_ID,
  );
}

function isNotExpired(expiresAt) {
  if (!expiresAt) {
    return true;
  }

  const timestamp =
    new Date(expiresAt).getTime();

  return (
    Number.isFinite(timestamp) &&
    timestamp > Date.now()
  );
}

export async function handleCourseJoinRequest(
  joinRequest,
  env,
  db,
) {
  if (
    !joinRequest?.from ||
    !joinRequest?.chat
  ) {
    return;
  }

  const channelId =
    getChannelId(env);

  if (
    String(joinRequest.chat.id) !==
    channelId
  ) {
    return;
  }

  const botToken =
    env?.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error(
      'TELEGRAM_BOT_TOKEN is missing.',
    );
  }

  const requesterId =
    joinRequest.from.id;

  const usedInviteLink =
    joinRequest.invite_link
      ?.invite_link ?? null;

  const linkedPurchase =
    usedInviteLink
      ? await getPurchaseByInviteLink(
          db,
          usedInviteLink,
        )
      : null;

  const activeRequesterPurchase =
    await getActivePurchaseByTelegramId(
      db,
      requesterId,
    );

  const activeBuyer =
    await getActiveCourseBuyer(
      db,
      requesterId,
    );

  const validLinkedPurchase =
    linkedPurchase &&
    Number(
      linkedPurchase.telegram_id,
    ) === Number(requesterId) &&
    linkedPurchase.status ===
      'approved' &&
    linkedPurchase.access_status ===
      'active' &&
    isNotExpired(
      linkedPurchase.expires_at,
    );

  if (validLinkedPurchase) {
    await approveChatJoinRequest(
      botToken,
      channelId,
      requesterId,
    );

    await markPurchaseJoined(
      db,
      linkedPurchase.id,
    );

    try {
      await revokeChatInviteLink(
        botToken,
        channelId,
        usedInviteLink,
      );
    } catch (error) {
      console.warn(
        'Could not revoke consumed invite:',
        error.message,
      );
    }

    await clearPurchaseInviteLink(
      db,
      linkedPurchase.id,
    );

    try {
      await sendMessage(
        botToken,
        requesterId,
        `✅ <b>عضویت شما با موفقیت تأیید شد.</b>\n\n` +
          `دسترسی شما به کانال خصوصی فعال است.\n\n` +
          `لطفاً لینک اختصاصی خود را با دیگران به اشتراک نگذارید.`,
      );
    } catch (error) {
      console.warn(
        'Join confirmation failed:',
        error.message,
      );
    }

    return;
  }

  try {
    await declineChatJoinRequest(
      botToken,
      channelId,
      requesterId,
    );
  } catch (error) {
    console.warn(
      'Could not decline join request:',
      error.message,
    );
  }

  if (
    usedInviteLink &&
    linkedPurchase
  ) {
    try {
      await revokeChatInviteLink(
        botToken,
        channelId,
        usedInviteLink,
      );
    } catch (error) {
      console.warn(
        'Could not revoke unauthorized invite:',
        error.message,
      );
    }
  }

  if (
    activeRequesterPurchase ||
    activeBuyer
  ) {
    if (activeRequesterPurchase) {
      try {
        await sendAccessLink(
          db,
          env,
          activeRequesterPurchase,
          'این لینک برای حساب دیگری صادر شده بود و قابل استفاده برای شما نیست. لینک اختصاصی جدید مخصوص حساب خودتان ایجاد شد.',
        );
      } catch (error) {
        console.error(
          'Could not send replacement invite:',
          error.message,
        );
      }
    }

    return;
  }

  try {
    await sendMessage(
      botToken,
      joinRequest.user_chat_id ??
        requesterId,
      `⛔ <b>این لینک برای حساب دیگری صادر شده است.</b>\n\n` +
        `اشتراک‌ها فقط برای همان حساب Telegram که خرید را انجام داده فعال می‌شوند.\n\n` +
        `برای تهیه اشتراک، از منوی ربات اقدام کنید.`,
    );
  } catch (error) {
    console.warn(
      'Unauthorized join notification failed:',
      error.message,
    );
  }
}

export default handleCourseJoinRequest;
