import handleMessage from './messageHandler.js';
import { sendMessage } from '../api/telegram.js';
import { ensureUser } from '../database/users.js';
import {
  createPurchase,
  getPendingBlupalPurchase,
  attachBlupalInvoice,
  cancelWaitingPurchase,
  getActivePurchase,
} from '../database/coursePurchases.js';
import { createBlupalInvoice } from '../api/blupal.js';
import { buildPaymentMessage, buildPaymentKeyboard } from '../utils/paymentMessage.js';
import { COURSE_MENU_BUTTONS, getCourseMenuKeyboard } from '../../keyboards/courseMenu.js';
import { getCoursePlansKeyboard, getPlanFromButton } from '../../keyboards/coursePlans.js';
import { formatToman } from '../config/coursePlans.js';
import { issueFreshInviteLink } from './courseAccessHandler.js';

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
    `مدت اشتراک موردنظر خود را انتخاب کنید.\n\n` +
    `• ۷ روز — <b>۴۰٬۰۰۰ تومان</b>\n` +
    `• ۳۰ روز — <b>۱۲۰٬۰۰۰ تومان</b>\n` +
    `• ۹۰ روز — <b>۲۴۰٬۰۰۰ تومان</b>\n` +
    `• ۱۸۰ روز — <b>۳۵۰٬۰۰۰ تومان</b>\n` +
    `• دائمی — <b>۴۵۰٬۰۰۰ تومان</b>`,
    getCoursePlansKeyboard(),
  );
}

async function sendActiveStatus(message, env, db, purchase) {
  const inviteLink = await issueFreshInviteLink(db, env, purchase);
  const expiryText = purchase.expires_at
    ? new Date(purchase.expires_at).toLocaleString('fa-IR')
    : 'بدون تاریخ انقضا';
  const planTitle = purchase.course_plan === '7d'
    ? '۷ روز'
    : purchase.course_plan === '30d'
      ? '۳۰ روز'
      : purchase.course_plan === '90d'
        ? '۹۰ روز'
        : purchase.course_plan === '180d'
          ? '۱۸۰ روز'
          : 'دائمی';

  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    `✅ <b>اشتراک شما فعال است</b>\n\n` +
    `نوع اشتراک: <b>${planTitle}</b>\n` +
    `اعتبار تا: <b>${escapeHtml(expiryText)}</b>\n\n` +
    `این اشتراک فقط برای حساب Telegram شما فعال شده است.\n\n` +
    `<a href="${escapeHtml(inviteLink)}">ورود به کانال خصوصی</a>`,
    getCourseMenuKeyboard(),
  );
}

async function startSubscriptionPurchase(message, env, db, plan) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = message.chat.id;

  if (!db) {
    return sendMessage(botToken, chatId, '❌ دیتابیس در دسترس نیست.', getCourseMenuKeyboard());
  }

  try {
    const user = await ensureUser(db, message.from);
    if (!user?.id) throw new Error('Could not resolve internal user id');

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
        paymentLink: pendingPurchase.blupal_payment_link ?? null,
      });

      return sendMessage(
        botToken,
        chatId,
        `⚠️ <b>فاکتور قبلی شما هنوز در انتظار پرداخت است.</b>\n\n${paymentMessage}`,
        buildPaymentKeyboard({
          finalAmountRial: Number(pendingPurchase.blupal_final_amount),
          paymentLink: pendingPurchase.blupal_payment_link ?? null,
        }),
      );
    }

    const purchase = await createPurchase(db, user.id, plan);
    let invoice;

    try {
      invoice = await createBlupalInvoice(env, purchase.rialAmount);
      await attachBlupalInvoice(db, purchase.id, invoice);

      const paymentMessage = buildPaymentMessage({
        baseAmountRial: Number(invoice.amount),
        finalAmountRial: Number(invoice.final_amount),
        expiresAt: invoice.expires_at ?? null,
        paymentLink: invoice.payment_link ?? null,
        cardNumber: invoice.card_number ?? null,
      });

      return sendMessage(
        botToken,
        chatId,
        `🛒 <b>اشتراک ${escapeHtml(plan.title)}</b>\n\n` +
        `مبلغ اشتراک: <b>${formatToman(plan.priceToman)} تومان</b>\n\n` +
        paymentMessage,
        buildPaymentKeyboard({
          finalAmountRial: Number(invoice.final_amount),
          paymentLink: invoice.payment_link ?? null,
        }),
      );
    } catch (error) {
      await cancelWaitingPurchase(db, purchase.id);
      throw error;
    }
  } catch (error) {
    console.error('❌ Subscription purchase error:', error.message, error.stack);
    return sendMessage(
      botToken,
      chatId,
      `❌ ساخت فاکتور پرداخت انجام نشد.\n\n<code>${escapeHtml(error.message)}</code>`,
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
