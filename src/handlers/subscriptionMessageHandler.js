import handleMessage from './messageHandler.js';

import {
  sendMessage,
} from '../api/telegram.js';

import {
  getCoursePlansKeyboard,
  getPlanFromButton,
} from '../../keyboards/coursePlans.js';

import {
  COURSE_MENU_BUTTONS,
  getCourseMenuKeyboard,
} from '../../keyboards/courseMenu.js';

import {
  COURSE_PLAN_LIST,
  formatToman,
} from '../config/coursePlans.js';

import {
  buildPaymentMessage,
  buildPaymentKeyboard,
} from '../utils/paymentMessage.js';

import {
  issueFreshInviteLink,
} from '../services/courseAccessService.js';

import {
  resolveSubscriptionContext,
  createSubscriptionInvoice,
  recoverPendingSubscription,
} from '../services/subscriptionService.js';

const OLD_BUY_BUTTON =
  '💳 خرید مستقیم دوره';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isBuySubscriptionButton(text) {
  return (
    text ===
      COURSE_MENU_BUTTONS.BUY_DIRECT ||
    text === OLD_BUY_BUTTON
  );
}

function getPlanTitle(plan) {
  return (
    plan?.title ||
    'اشتراک'
  );
}

function buildPlanListText() {
  return COURSE_PLAN_LIST
    .map(
      (plan) =>
        `• ${plan.title} — <b>${formatToman(
          plan.priceToman,
        )} تومان</b>`,
    )
    .join('\n');
}

function buildPendingPaymentResponse(
  plan,
  pendingPurchase,
) {
  const paymentMessage =
    buildPaymentMessage({
      baseAmountRial:
        Number(
          pendingPurchase.amount,
        ),

      finalAmountRial:
        Number(
          pendingPurchase.blupal_final_amount,
        ),

      expiresAt:
        pendingPurchase.blupal_expires_at ??
        null,

      paymentLink:
        pendingPurchase.blupal_payment_link ??
        null,
    });

  const paymentKeyboard =
    buildPaymentKeyboard({
      finalAmountRial:
        Number(
          pendingPurchase.blupal_final_amount,
        ),

      paymentLink:
        pendingPurchase.blupal_payment_link ??
        null,
    });

  return {
    text:
      `⚠️ <b>فاکتور ${escapeHtml(
        getPlanTitle(plan),
      )} هنوز معتبر است.</b>\n\n` +
      paymentMessage,

    keyboard:
      paymentKeyboard,
  };
}

async function showPlans(
  message,
  env,
) {
  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    `💳 <b>انتخاب اشتراک</b>\n\n` +
      `مدت اشتراک موردنظر خود را انتخاب کنید.\n\n` +
      `${buildPlanListText()}\n\n` +
      `پس از تأیید پرداخت، اشتراک فقط برای همین حساب Telegram فعال می‌شود.`,
    getCoursePlansKeyboard(),
  );
}

async function sendActiveStatus(
  message,
  env,
  db,
  purchase,
) {
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
      : 'بدون تاریخ انقضا';

  const plan =
    COURSE_PLAN_LIST.find(
      (item) =>
        item.code ===
        purchase.course_plan,
    );

  const planTitle =
    plan?.title ||
    'دائمی';

  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,

    `✅ <b>اشتراک شما فعال است</b>\n\n` +
      `نوع اشتراک: <b>${escapeHtml(
        planTitle,
      )}</b>\n` +
      `اعتبار تا: <b>${escapeHtml(
        expiryText,
      )}</b>\n\n` +
      `این اشتراک فقط برای حساب Telegram شما فعال شده است.\n\n` +
      `<a href="${escapeHtml(
        inviteLink,
      )}">ورود به کانال خصوصی</a>`,

    getCourseMenuKeyboard(),
  );
}

async function sendPendingPayment(
  message,
  botToken,
  plan,
  pendingPurchase,
) {
  const response =
    buildPendingPaymentResponse(
      plan,
      pendingPurchase,
    );

  return sendMessage(
    botToken,
    message.chat.id,
    response.text,
    response.keyboard,
  );
}

async function startSubscriptionPurchase(
  message,
  env,
  db,
  plan,
) {
  const botToken =
    env.TELEGRAM_BOT_TOKEN;

  const chatId =
    message.chat.id;

  if (!db) {
    return sendMessage(
      botToken,
      chatId,
      '❌ دیتابیس در دسترس نیست.',
      getCourseMenuKeyboard(),
    );
  }

  try {
    const context =
      await resolveSubscriptionContext(
        db,
        message.from,
        plan,
      );

    if (
      context.activePurchase
    ) {
      return sendActiveStatus(
        message,
        env,
        db,
        context.activePurchase,
      );
    }

    if (
      context.pendingPurchase
    ) {
      return sendPendingPayment(
        message,
        botToken,
        plan,
        context.pendingPurchase,
      );
    }

    const invoice =
      await createSubscriptionInvoice(
        db,
        env,
        context.purchase,
      );

    const paymentMessage =
      buildPaymentMessage({
        baseAmountRial:
          Number(
            invoice.amount,
          ),

        finalAmountRial:
          Number(
            invoice.final_amount,
          ),

        expiresAt:
          invoice.expires_at ??
          null,

        paymentLink:
          invoice.payment_link ??
          null,

        cardNumber:
          invoice.card_number ??
          null,
      });

    const paymentKeyboard =
      buildPaymentKeyboard({
        finalAmountRial:
          Number(
            invoice.final_amount,
          ),

        paymentLink:
          invoice.payment_link ??
          null,

        cardNumber:
          invoice.card_number ??
          null,
      });

    return sendMessage(
      botToken,
      chatId,

      `🛒 <b>اشتراک ${escapeHtml(
        getPlanTitle(plan),
      )}</b>\n\n` +

        `مبلغ اشتراک: <b>${formatToman(
          plan.priceToman,
        )} تومان</b>\n\n` +

        paymentMessage,

      paymentKeyboard,
    );
  } catch (error) {
    const pendingPurchase =
      await recoverPendingSubscription(
        db,
        message.from,
        plan,
      );

    if (
      pendingPurchase?.blupal_invoice_id &&
      pendingPurchase?.blupal_final_amount
    ) {
      return sendPendingPayment(
        message,
        botToken,
        plan,
        pendingPurchase,
      );
    }

    console.error(
      'Subscription purchase error:',
      error.message,
      error.stack,
    );

    return sendMessage(
      botToken,
      chatId,

      `❌ <b>ساخت فاکتور انجام نشد.</b>\n\n` +
        `<code>${escapeHtml(
          error.message,
        )}</code>`,

      getCourseMenuKeyboard(),
    );
  }
}

export default async function handleSubscriptionMessage(
  message,
  env,
  db,
) {
  if (
    !message?.chat ||
    !message?.from
  ) {
    return;
  }

  const text =
    message.text?.trim();

  if (
    isBuySubscriptionButton(text)
  ) {
    return showPlans(
      message,
      env,
    );
  }

  const plan =
    getPlanFromButton(
      text,
    );

  if (plan) {
    return startSubscriptionPurchase(
      message,
      env,
      db,
      plan,
    );
  }

  return handleMessage(
    message,
    env,
    db,
  );
}
