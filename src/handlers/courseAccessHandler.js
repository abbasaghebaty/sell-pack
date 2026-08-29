import {
  approveChatJoinRequest,
  createChatInviteLink,
  declineChatJoinRequest,
  revokeChatInviteLink,
  sendMessage,
  unbanChatMember,
} from '../api/telegram.js';

import {
  clearPurchaseInviteLink,
  deactivateCourseBuyer,
  getActiveCourseBuyer,
  getActivePurchaseByTelegramId,
  getExpiredPurchases,
  getPurchaseByInviteLink,
  markPurchaseExpired,
  markPurchaseJoined,
  savePurchaseInviteLink,
  setPurchaseActivation,
  upsertCourseBuyer,
} from '../database/coursePurchases.js';

import {
  getCoursePlan,
} from '../config/coursePlans.js';

export const COURSE_CHANNEL_ID =
  '-1004412265336';

const INVITE_LINK_TTL_SECONDS =
  24 * 60 * 60;

function getChannelId(env) {
  return String(
    env?.COURSE_CHANNEL_ID ||
    COURSE_CHANNEL_ID
  );
}

function isNotExpired(
  expiresAt
) {
  if (!expiresAt) {
    return true;
  }

  const timestamp =
    new Date(
      expiresAt
    ).getTime();

  return (
    Number.isFinite(
      timestamp
    ) &&
    timestamp > Date.now()
  );
}

function calculateExpiry(
  durationDays,
  base = new Date()
) {
  if (
    !durationDays
  ) {
    return null;
  }

  return new Date(
    base.getTime() +
      durationDays *
        24 *
        60 *
        60 *
        1000
  ).toISOString();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );
}

/**
 * ساخت لینک اختصاصی
 */
export async function issueFreshInviteLink(
  db,
  env,
  purchase,
  forceNew = false
) {
  const botToken =
    env?.TELEGRAM_BOT_TOKEN;

  const channelId =
    getChannelId(env);

  if (!botToken) {
    throw new Error(
      'TELEGRAM_BOT_TOKEN is missing.'
    );
  }

  if (!purchase?.id) {
    throw new Error(
      'Purchase is missing.'
    );
  }

  /*
   * اگر لینک قبلی هنوز معتبر است
   * همان را برگردان.
   */
  if (
    !forceNew &&
    purchase.invite_link &&
    purchase.invite_link_expires_at &&
    isNotExpired(
      purchase.invite_link_expires_at
    )
  ) {
    return purchase.invite_link;
  }

  /*
   * لینک قدیمی
   */
  if (
    purchase.invite_link
  ) {
    try {
      await revokeChatInviteLink(
        botToken,
        channelId,
        purchase.invite_link
      );
    } catch (error) {
      console.warn(
        'Could not revoke old invite:',
        error.message
      );
    }
  }

  const inviteExpiresAt =
    new Date(
      Date.now() +
        INVITE_LINK_TTL_SECONDS *
          1000
    );

  const invite =
    await createChatInviteLink(
      botToken,
      channelId,
      {
        name:
          `purchase-${purchase.id}`,

        expireDate:
          Math.floor(
            inviteExpiresAt.getTime() /
              1000
          ),
      }
    );

  if (
    !invite?.invite_link
  ) {
    throw new Error(
      'Telegram did not return invite link.'
    );
  }

  await savePurchaseInviteLink(
    db,

    purchase.id,

    invite.invite_link,

    inviteExpiresAt.toISOString()
  );

  return invite.invite_link;
}

/**
 * فعال‌سازی خرید
 */
export async function activateCoursePurchase(
  db,
  env,
  purchase
) {
  const plan =
    getCoursePlan(
      purchase.course_plan
    );

  if (
    !plan &&
    purchase.course_plan !==
      'legacy'
  ) {
    throw new Error(
      `Unknown course plan: ${purchase.course_plan}`
    );
  }

  let expiresAt =
    purchase.expires_at ??
    null;

  /*
   * اگر دائمی است:
   * expiresAt = null
   *
   * اگر زمان‌دار است:
   * از لحظه تایید پرداخت
   * مدت را محاسبه کن.
   */
  if (
    plan?.durationDays
  ) {
    expiresAt =
      calculateExpiry(
        plan.durationDays
      );
  } else {
    expiresAt = null;
  }

  await setPurchaseActivation(
    db,
    purchase.id,
    expiresAt
  );

  /*
   * White list
   */
  await upsertCourseBuyer(
    db,

    purchase.telegram_id,

    purchase.course_plan ||
      'legacy',

    purchase.paid_at ||
      new Date().toISOString(),

    expiresAt
  );

  const freshPurchase =
    await db
      .prepare(`
        SELECT
          cp.*,
          u.telegram_id,
          u.username,
          u.first_name,
          u.last_name
        FROM course_purchases cp
        INNER JOIN users u
          ON u.id = cp.user_id
        WHERE cp.id = ?
        LIMIT 1
      `)
      .bind(
        purchase.id
      )
      .first();

  const inviteLink =
    await issueFreshInviteLink(
      db,
      env,
      freshPurchase,
      true
    );

  return {
    purchase: {
      ...freshPurchase,
      invite_link:
        inviteLink,
    },

    inviteLink,
  };
}

/**
 * ارسال لینک دسترسی
 */
export async function sendAccessLink(
  db,
  env,
  purchase,
  extraText = ''
) {
  const botToken =
    env?.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error(
      'TELEGRAM_BOT_TOKEN is missing.'
    );
  }

  const plan =
    getCoursePlan(
      purchase.course_plan
    );

  const inviteLink =
    await issueFreshInviteLink(
      db,
      env,
      purchase
    );

  const expiryText =
    purchase.expires_at
      ? new Date(
          purchase.expires_at
        ).toLocaleString(
          'fa-IR'
        )
      : 'بدون محدودیت زمانی';

  const text =
    `🔐 <b>دسترسی اختصاصی شما</b>\n\n` +

    `${
      extraText
        ? `${escapeHtml(
            extraText
          )}\n\n`
        : ''
    }` +

    `اشتراک: <b>${escapeHtml(
      plan?.title ||
        'دائمی'
    )}</b>\n` +

    `اعتبار تا: <b>${escapeHtml(
      expiryText
    )}</b>\n\n` +

    `این لینک فقط برای حساب Telegram خودتان صادر شده است.\n\n` +

    `<a href="${escapeHtml(
      inviteLink
    )}">ورود به کانال خصوصی</a>`;

  await sendMessage(
    botToken,

    purchase.telegram_id,

    text
  );

  return inviteLink;
}

/**
 * Join Request
 */
export async function handleCourseJoinRequest(
  joinRequest,
  env,
  db
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
    String(
      joinRequest.chat.id
    ) !== channelId
  ) {
    return;
  }

  const botToken =
    env?.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error(
      'TELEGRAM_BOT_TOKEN is missing.'
    );
  }

  const requesterId =
    joinRequest.from.id;

  const usedInviteLink =
    joinRequest.invite_link
      ?.invite_link ??
    null;

  /*
   * پیدا کردن خریدی که لینک برای آن بوده
   */
  const linkedPurchase =
    usedInviteLink
      ? await getPurchaseByInviteLink(
          db,
          usedInviteLink
        )
      : null;

  /*
   * پیدا کردن اشتراک خود شخص
   */
  const activeRequesterPurchase =
    await getActivePurchaseByTelegramId(
      db,
      requesterId
    );

  const activeBuyer =
    await getActiveCourseBuyer(
      db,
      requesterId
    );

  /*
   * آیا لینک واقعاً برای همین Telegram ID است؟
   */
  const validLinkedPurchase =
    linkedPurchase &&
    Number(
      linkedPurchase.telegram_id
    ) ===
      Number(requesterId) &&

    linkedPurchase.status ===
      'approved' &&

    linkedPurchase.access_status ===
      'active' &&

    isNotExpired(
      linkedPurchase.expires_at
    );

  /*
   * مالک اصلی لینک
   */
  if (
    validLinkedPurchase
  ) {
    await approveChatJoinRequest(
      botToken,
      channelId,
      requesterId
    );

    await markPurchaseJoined(
      db,
      linkedPurchase.id
    );

    try {
      await revokeChatInviteLink(
        botToken,
        channelId,
        usedInviteLink
      );
    } catch (error) {
      console.warn(
        'Could not revoke consumed invite:',
        error.message
      );
    }

    await clearPurchaseInviteLink(
      db,
      linkedPurchase.id
    );

    try {
      await sendMessage(
        botToken,
        requesterId,

        `✅ <b>عضویت شما با موفقیت تأیید شد.</b>\n\n` +
        `دسترسی شما به کانال خصوصی فعال است.\n\n` +
        `لطفاً لینک اختصاصی خود را با دیگران به اشتراک نگذارید.`
      );
    } catch (error) {
      console.warn(
        'Join confirmation failed:',
        error.message
      );
    }

    return;
  }

  /*
   * شخص دیگری با لینک علی آمده
   */
  try {
    await declineChatJoinRequest(
      botToken,
      channelId,
      requesterId
    );
  } catch (error) {
    console.warn(
      'Could not decline join request:',
      error.message
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
        usedInviteLink
      );
    } catch (error) {
      console.warn(
        'Could not revoke unauthorized invite:',
        error.message
      );
    }
  }

  /*
   * اگر شخص خودش اشتراک دارد،
   * لینک خودش را برایش بساز.
   */
  if (
    activeRequesterPurchase ||
    activeBuyer
  ) {
    const ownPurchase =
      activeRequesterPurchase;

    if (ownPurchase) {
      try {
        await sendAccessLink(
          db,
          env,
          ownPurchase,

          `این لینک برای حساب دیگری صادر شده بود و قابل استفاده برای شما نیست. لینک اختصاصی جدید مخصوص حساب خودتان ایجاد شد.`
        );
      } catch (error) {
        console.error(
          'Could not send replacement invite:',
          error.message
        );
      }
    }

    return;
  }

  /*
   * شخص اشتراک ندارد
   */
  try {
    await sendMessage(
      botToken,

      joinRequest.user_chat_id ??
        requesterId,

      `⛔ <b>این لینک برای حساب دیگری صادر شده است.</b>\n\n` +

      `اشتراک‌ها فقط برای همان حساب Telegram که خرید را انجام داده فعال می‌شوند.\n\n` +

      `برای تهیه اشتراک، از منوی ربات اقدام کنید.`
    );
  } catch (error) {
    console.warn(
      'Unauthorized join notification failed:',
      error.message
    );
  }
}

/**
 * بررسی اشتراک‌های منقضی
 */
export async function expireCourses(
  db,
  env
) {
  const botToken =
    env?.TELEGRAM_BOT_TOKEN;

  if (
    !botToken ||
    !db
  ) {
    return;
  }

  const channelId =
    getChannelId(env);

  const expiredPurchases =
    await getExpiredPurchases(
      db
    );

  for (
    const purchase of
    expiredPurchases
  ) {
    try {
      /*
       * لینک را باطل کن
       */
      if (
        purchase.invite_link
      ) {
        try {
          await revokeChatInviteLink(
            botToken,
            channelId,
            purchase.invite_link
          );
        } catch (error) {
          console.warn(
            `Could not revoke expired invite ${purchase.id}:`,
            error.message
          );
        }
      }

      /*
       * خارج کردن کاربر
       */
      try {
        await unbanChatMember(
          botToken,
          channelId,
          purchase.telegram_id
        );
      } catch (error) {
        console.warn(
          `Could not remove ${purchase.telegram_id}:`,
          error.message
        );
      }

      /*
       * تغییر وضعیت DB
       */
      await markPurchaseExpired(
        db,
        purchase.id
      );

      await deactivateCourseBuyer(
        db,
        purchase.telegram_id
      );

      /*
       * اطلاع‌رسانی
       */
      try {
        await sendMessage(
          botToken,

          purchase.telegram_id,

          `⏳ <b>اشتراک شما به پایان رسید</b>\n\n` +

          `با عرض پوزش، مدت اشتراک شما به پایان رسیده و دسترسی شما به کانال خصوصی حذف شد.\n\n` +

          `برای فعال‌سازی مجدد، می‌توانید از منوی زیر اشتراک جدید تهیه کنید.`
        );
      } catch (error) {
        console.warn(
          `Could not notify ${purchase.telegram_id}:`,
          error.message
        );
      }
    } catch (error) {
      console.error(
        `Failed to expire purchase ${purchase.id}:`,
        error.message,
        error.stack
      );
    }
  }
}
