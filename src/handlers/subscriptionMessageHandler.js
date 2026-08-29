import handleMessage from './messageHandler.js';

import {
  sendMessage,
} from '../api/telegram.js';

import {
  ensureUser,
} from '../database/users.js';

import {
  createPurchase,
  getPendingBlupalPurchase,
  attachBlupalInvoice,
  cancelWaitingPurchase,
  getActivePurchase,
} from '../database/coursePurchases.js';

import {
  createBlupalInvoice,
} from '../api/blupal.js';

import {
  buildPaymentMessage,
  buildPaymentKeyboard,
} from '../utils/paymentMessage.js';

import {
  COURSE_MENU_BUTTONS,
  getCourseMenuKeyboard,
} from '../../keyboards/courseMenu.js';

import {
  getCoursePlansKeyboard,
  getPlanFromButton,
} from '../../keyboards/coursePlans.js';

import {
  formatToman,
} from '../config/coursePlans.js';

import {
  issueFreshInviteLink,
} from './courseAccessHandler.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function showPlans(message, env) {
  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    `💳 <b>انتخاب اشتراک</b>\n\n` +
    `اشتراک موردنظر خود را انتخاب کنید. دسترسی دوره بعد از تأیید پرداخت فعال می‌شود و مدت اعتبار دقیقاً بر اساس پلن انتخابی ثبت خواهد شد.\n\n` +
    `<b>۷ روز:</b> ۴۰٬۰۰۰ تومان\n` +
    `<b>۳۰ روز:</b> ۱۲۰٬۰۰۰ تومان\n` +
    `<b>۹۰ روز:</b> ۲۴۰٬۰۰۰ تومان\n` +
    `<b>۱۸۰ روز:</b> ۳۵۰٬۰۰۰ تومان\n` +
    `<b>دائمی:</b> ۴۵۰٬۰۰۰ تومان`,
    getCoursePlansKeyboard(),
  );
}

async function sendActiveStatus(message, env, db, purchase) {
  const inviteLink = await issueFreshInviteLink(db, env, purchase);
  const expiryText = purchase.expires_at
    ? new Date(purchase.expires_at).toLocaleString('fa-IR')
    : 'بدون تاریخ انقضا';

  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    `✅ <b>اشتراک شما فعال است</b>\n\n` +
    `این اشتراک فقط برای حساب Telegram شما فعال شده است.\n\n` +
    `اعتبار تا: <b>${escapeHtml(expiryText)}</b>\n\n` +
    `<a href="${escapeHtml(inviteLink)}">دریافت لینک ورود اختصاصی</a>`,
    getCourseMenuKeyboard(),
  );
}

async function startSubscriptionPurchase(message, env, db, plan) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = message.chat.id;

  if (!db) {
    return sendMessage(
      botToken,
      chatId,
      '❌ دیتابیس در دسترس نیست. لطفاً بعداً دوباره تلاش کنید.',
      getCourseMenuKeyboard(),
    );
  }

  try {
    const user = await ensureUser(db, message.from);

    if (!user?.id) {
      throw new Error('Could not resolve internal user id');
    }

    const activePurchase = await getActivePurchase(db, user.id);

    if (activePurchase) {
      return sendActiveStatus(message, env, db, activePurchase);
    }

    const pendingPurchase = await getPendingBlupalPurchase(db, user.id);

    if (pendingPurchase?.blupal_invoice_id && pendingPurchase?.blupal_final_amount) {
      const paymentMessage = buildPaymentMessage({
        baseAmountRial: Number(pendingPurchase.amount),
        finalAmountRial: Number(pendingPurchase.blupal_final_amount),
        expiresAt: pendingPurchase.blupal_expires_at ?? null,
      });

      return sendMessage(
        botToken,
        chatId,
        `⚠️ <b>فاکتور قبلی شما هنوز در انتظار پرداخت است.</b>\n\n` +
        `${paymentMessage}`,
        buildPaymentKeyboard(Number(pendingPurchase.blupal_final_amount)),
      );
    }

    const purchase = await createPurchase(db, user.id, plan);

    try {
      const invoice = await createBlupalInvoice(env, purchase.rialAmount);

      await attachBlupalInvoice(db, purchase.id, invoice);

      const paymentMessage = buildPaymentMessage({
        baseAmountRial: Number(invoice.amount),
        finalAmountRial: Number(invoice.final_amount),
        expiresAt: invoice.expires_at ?? null,
      });

      return sendMessage(
        botToken,
        chatId,
        `🛒 <b>اشتراک ${escapeHtml(plan.title)}</b>\n\n` +
        `مبلغ اشتراک: <b>${formatToman(plan.priceToman)}</b> تومان\n\n` +
        paymentMessage,
        buildPaymentKeyboard(Number(invoice.final_amount)),
      );
    } catch (invoiceError) {
      await cancelWaitingPurchase(db, purchase.id);
      throw invoiceError;
    }
  } catch (error) {
    console.error('❌ Subscription purchase error:', error.message, error.stack);

    return sendMessage(
      botToken,
      chatId,
      '❌ ساخت فاکتور پرداخت انجام نشد. لطفاً چند لحظه بعد دوباره تلاش کنید.',
      getCourseMenuKeyboard(),
    );
  }
}

export default async function handleSubscriptionMessage(message, env, db) {
  if (!message?.chat || !message?.from) return;

  const text = message.text?.trim();

  if (text === COURSE_MENU_BUTTONS.BUY_DIRECT) {
    return showPlans(message, env);
  }

  const plan = getPlanFromButton(text);
  if (plan) {
    return startSubscriptionPurchase(message, env, db, plan);
  }

  return handleMessage(message, env, db);
}
