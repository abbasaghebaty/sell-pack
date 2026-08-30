import {
  createChatInviteLink,
  revokeChatInviteLink,
  sendMessage,
} from '../api/telegram.js';

import {
  setPurchaseActivation,
  findPurchaseById,
} from '../database/coursePurchasesQueries.js';

import {
  upsertCourseBuyer,
} from '../database/courseBuyers.js';

import {
  savePurchaseInviteLink,
} from '../database/purchaseInvites.js';

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

function calculateExpiry(
  durationDays,
  base = new Date(),
) {
  if (!durationDays) {
    return null;
  }

  return new Date(
    base.getTime() +
      durationDays *
        24 *
        60 *
        60 *
        1000,
  ).toISOString();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function issueFreshInviteLink(
  db,
  env,
  purchase,
  forceNew = false,
) {
  const botToken =
    env?.TELEGRAM_BOT_TOKEN;

  const channelId =
    getChannelId(env);

  if (!botToken) {
    throw new Error(
      'TELEGRAM_BOT_TOKEN is missing.',
    );
  }

  if (!purchase?.id) {
    throw new Error(
      'Purchase is missing.',
    );
  }

  if (
    !forceNew &&
    purchase.invite_link &&
    purchase.invite_link_expires_at &&
    isNotExpired(
      purchase.invite_link_expires_at,
    )
  ) {
    return purchase.invite_link;
  }

  if (purchase.invite_link) {
    try {
      await revokeChatInviteLink(
        botToken,
        channelId,
        purchase.invite_link,
      );
    } catch (error) {
      console.warn(
        'Could not revoke old invite:',
        error.message,
      );
    }
  }

  const inviteExpiresAt =
    new Date(
      Date.now() +
        INVITE_LINK_TTL_SECONDS *
          1000,
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
              1000,
          ),
      },
    );

  if (!invite?.invite_link) {
    throw new Error(
      'Telegram did not return invite link.',
    );
  }

  await savePurchaseInviteLink(
    db,
    purchase.id,
    invite.invite_link,
    inviteExpiresAt.toISOString(),
  );

  return invite.invite_link;
}

export async function activateCoursePurchase(
  db,
  env,
  purchase,
) {
  const plan =
    getCoursePlan(
      purchase.course_plan,
    );

  if (
    !plan &&
    purchase.course_plan !==
      'legacy'
  ) {
    throw new Error(
      `Unknown course plan: ${purchase.course_plan}`,
    );
  }

  const expiresAt =
    plan?.durationDays
      ? calculateExpiry(
          plan.durationDays,
        )
      : null;

  await setPurchaseActivation(
    db,
    purchase.id,
    expiresAt,
  );

  await upsertCourseBuyer(
    db,
    purchase.telegram_id,
    purchase.course_plan ||
      'legacy',
    purchase.paid_at ||
      new Date().toISOString(),
    expiresAt,
  );

  const freshPurchase =
    await findPurchaseById(
      db,
      purchase.id,
    );

  const inviteLink =
    await issueFreshInviteLink(
      db,
      env,
      freshPurchase,
      true,
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

export async function sendAccessLink(
  db,
  env,
  purchase,
  extraText = '',
) {
  const botToken =
    env?.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error(
      'TELEGRAM_BOT_TOKEN is missing.',
    );
  }

  const plan =
    getCoursePlan(
      purchase.course_plan,
    );

  const inviteLink =
    await issueFreshInviteLink(
      db,
      env,
      purchase,
    );

  const expiryText =
    purchase.expires_at
      ? new Date(
          purchase.expires_at,
        ).toLocaleString(
          'fa-IR',
        )
      : 'بدون محدودیت زمانی';

  const text =
    `🔐 <b>دسترسی اختصاصی شما</b>\n\n` +
    `${
      extraText
        ? `${escapeHtml(extraText)}\n\n`
        : ''
    }` +
    `اشتراک: <b>${escapeHtml(
      plan?.title ||
        'دائمی',
    )}</b>\n` +
    `اعتبار تا: <b>${escapeHtml(
      expiryText,
    )}</b>\n\n` +
    `این لینک فقط برای حساب Telegram خودتان صادر شده است.\n\n` +
    `<a href="${escapeHtml(
      inviteLink,
    )}">ورود به کانال خصوصی</a>`;

  await sendMessage(
    botToken,
    purchase.telegram_id,
    text,
  );

  return inviteLink;
}
