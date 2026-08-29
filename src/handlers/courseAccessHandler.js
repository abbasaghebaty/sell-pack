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

import { getCoursePlan } from '../config/coursePlans.js';

export const COURSE_CHANNEL_ID = '-1004412265336';
const INVITE_LINK_TTL_SECONDS = 24 * 60 * 60;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getChannelId(env) {
  return String(env?.COURSE_CHANNEL_ID || COURSE_CHANNEL_ID);
}

function calculateExpiry(durationDays, base = new Date()) {
  if (!durationDays) return null;
  return new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();
}

function isNotExpired(expiresAt) {
  return !expiresAt || new Date(expiresAt).getTime() > Date.now();
}

export async function issueFreshInviteLink(db, env, purchase, forceNew = false) {
  const botToken = env?.TELEGRAM_BOT_TOKEN;
  const channelId = getChannelId(env);

  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN is missing');
  if (!purchase?.id) throw new Error('Purchase is missing');

  const existingValidLink =
    !forceNew &&
    purchase.invite_link &&
    purchase.invite_link_expires_at &&
    new Date(purchase.invite_link_expires_at).getTime() > Date.now();

  if (existingValidLink) {
    return purchase.invite_link;
  }

  if (purchase.invite_link) {
    try {
      await revokeChatInviteLink(botToken, channelId, purchase.invite_link);
    } catch (error) {
      console.warn('Could not revoke old invite link:', error.message);
    }
  }

  const expiresAt = new Date(Date.now() + INVITE_LINK_TTL_SECONDS * 1000);
  const invite = await createChatInviteLink(botToken, channelId, {
    name: `purchase-${purchase.id}`,
    expireDate: Math.floor(expiresAt.getTime() / 1000),
  });

  if (!invite?.invite_link) {
    throw new Error('Telegram did not return an invite link');
  }

  await savePurchaseInviteLink(
    db,
    purchase.id,
    invite.invite_link,
    expiresAt.toISOString(),
  );

  return invite.invite_link;
}

export async function activateCoursePurchase(db, env, purchase) {
  const plan = getCoursePlan(purchase.course_plan);

  if (!plan && purchase.course_plan !== 'legacy') {
    throw new Error(`Unknown course plan: ${purchase.course_plan}`);
  }

  let expiresAt = purchase.expires_at ?? null;

  // First activation: duration starts when payment is approved.
  if (!purchase.expires_at || !isNotExpired(purchase.expires_at)) {
    expiresAt = calculateExpiry(plan?.durationDays ?? null);
  }

  await setPurchaseActivation(db, purchase.id, expiresAt);

  await upsertCourseBuyer(
    db,
    purchase.telegram_id,
    purchase.course_plan || 'legacy',
    purchase.paid_at || new Date().toISOString(),
    expiresAt,
  );

  const freshPurchase = await db.prepare(`
    SELECT cp.*, u.telegram_id, u.username, u.first_name, u.last_name
    FROM course_purchases cp
    INNER JOIN users u ON u.id = cp.user_id
    WHERE cp.id = ?
    LIMIT 1
  `).bind(purchase.id).first();

  const inviteLink = await issueFreshInviteLink(db, env, freshPurchase, true);

  return {
    purchase: { ...freshPurchase, invite_link: inviteLink },
    inviteLink,
  };
}

export async function sendAccessLink(db, env, purchase, extraText = '') {
  const botToken = env?.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN is missing');

  const plan = getCoursePlan(purchase.course_plan);
  const inviteLink = await issueFreshInviteLink(db, env, purchase);
  const expiryText = purchase.expires_at
    ? new Date(purchase.expires_at).toLocaleString('fa-IR')
    : 'بدون محدودیت زمانی';

  const text =
    `🔐 <b>دسترسی اختصاصی شما فعال است</b>\n\n` +
    `${extraText ? `${escapeHtml(extraText)}\n\n` : ''}` +
    `اشتراک: <b>${escapeHtml(plan?.title || 'دائمی')}</b>\n` +
    `اعتبار تا: <b>${escapeHtml(expiryText)}</b>\n\n` +
    `این لینک فقط برای حساب Telegram شما صادر شده است و پس از اولین ورود مصرف می‌شود.\n\n` +
    `<a href="${escapeHtml(inviteLink)}">ورود به کانال خصوصی</a>`;

  await sendMessage(botToken, purchase.telegram_id, text);
  return inviteLink;
}

export async function handleCourseJoinRequest(joinRequest, env, db) {
  if (!joinRequest?.from || !joinRequest?.chat) return;

  const channelId = getChannelId(env);
  if (String(joinRequest.chat.id) !== channelId) return;

  const botToken = env?.TELEGRAM_BOT_TOKEN;
  const requesterId = joinRequest.from.id;
  const usedInviteLink = joinRequest.invite_link?.invite_link ?? null;

  const linkedPurchase = usedInviteLink
    ? await getPurchaseByInviteLink(db, usedInviteLink)
    : null;

  const activeRequesterPurchase = await getActivePurchaseByTelegramId(db, requesterId);
  const activeBuyer = await getActiveCourseBuyer(db, requesterId);

  const validLinkedPurchase =
    linkedPurchase &&
    Number(linkedPurchase.telegram_id) === Number(requesterId) &&
    linkedPurchase.status === 'approved' &&
    linkedPurchase.access_status === 'active' &&
    isNotExpired(linkedPurchase.expires_at);

  if (validLinkedPurchase) {
    await approveChatJoinRequest(botToken, channelId, requesterId);
    await markPurchaseJoined(db, linkedPurchase.id);

    try {
      await revokeChatInviteLink(botToken, channelId, usedInviteLink);
    } catch (error) {
      console.warn('Could not revoke consumed invite link:', error.message);
    }

    await clearPurchaseInviteLink(db, linkedPurchase.id);

    try {
      await sendMessage(
        botToken,
        requesterId,
        `✅ <b>عضویت شما با موفقیت تأیید شد.</b>\n\n` +
        `دسترسی شما به کانال خصوصی فعال است.`,
      );
    } catch (error) {
      console.warn('Join approval notification failed:', error.message);
    }

    return;
  }

  await declineChatJoinRequest(botToken, channelId, requesterId);

  if (usedInviteLink && linkedPurchase) {
    try {
      await revokeChatInviteLink(botToken, channelId, usedInviteLink);
    } catch (error) {
      console.warn('Could not revoke unauthorized invite link:', error.message);
    }
  }

  if (activeRequesterPurchase || activeBuyer) {
    const purchase = activeRequesterPurchase || await getActivePurchaseByTelegramId(db, requesterId);

    try {
      await sendAccessLink(
        db,
        env,
        purchase,
        'این لینک برای حساب دیگری صادر شده بود و قابل استفاده برای شما نیست. لینک اختصاصی جدید برای حساب خودتان ایجاد شد.',
      );
    } catch (error) {
      console.error('Could not send replacement invite:', error.message);
    }
    return;
  }

  try {
    await sendMessage(
      botToken,
      joinRequest.user_chat_id ?? requesterId,
      `⛔ <b>این لینک برای حساب دیگری صادر شده است.</b>\n\n` +
      `هر اشتراک فقط برای همان حساب Telegram فعال می‌شود و امکان استفاده از لینک دیگران وجود ندارد.`,
    );
  } catch (error) {
    console.warn('Unauthorized join notification failed:', error.message);
  }
}

export async function expireCourses(db, env) {
  const botToken = env?.TELEGRAM_BOT_TOKEN;
  if (!botToken || !db) return;

  const channelId = getChannelId(env);
  const expiredPurchases = await getExpiredPurchases(db);

  for (const purchase of expiredPurchases) {
    try {
      if (purchase.invite_link) {
        try {
          await revokeChatInviteLink(botToken, channelId, purchase.invite_link);
        } catch (error) {
          console.warn(`Could not revoke expired link ${purchase.id}:`, error.message);
        }
      }

      // Telegram's unbanChatMember removes an existing member while allowing
      // the user to join again later through a new invite link.
      try {
        await unbanChatMember(botToken, channelId, purchase.telegram_id);
      } catch (error) {
        console.warn(`Could not remove Telegram user ${purchase.telegram_id}:`, error.message);
      }

      await markPurchaseExpired(db, purchase.id);
      await deactivateCourseBuyer(db, purchase.telegram_id);

      try {
        await sendMessage(
          botToken,
          purchase.telegram_id,
          `⏳ <b>اشتراک شما به پایان رسید</b>\n\n` +
          `با عرض پوزش، مدت اشتراک شما به پایان رسیده و دسترسی شما به کانال خصوصی حذف شد.\n\n` +
          `برای فعال‌سازی مجدد، می‌توانید از منوی زیر اشتراک جدید تهیه کنید.`,
        );
      } catch (error) {
        console.warn(`Could not notify expired user ${purchase.telegram_id}:`, error.message);
      }
    } catch (error) {
      console.error(`Failed to expire purchase ${purchase.id}:`, error.message);
    }
  }
}
