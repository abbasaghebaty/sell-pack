import {
  approveBlupalPurchase,
  findPurchaseByInvoiceId,
  cancelWaitingPurchase,
} from '../database/coursePurchasesQueries.js';

import {
  activateCoursePurchase,
} from './courseAccessService.js';

import {
  getCoursePlan,
} from '../config/coursePlans.js';

import {
  settleCoursePaymentToWallet,
} from './walletService.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getExpectedBlupalMode(
  apiKey,
) {
  const key =
    apiKey?.trim() || '';

  if (
    key.startsWith('blu_test_')
  ) {
    return 'sandbox';
  }

  if (
    key.startsWith('blu_live_')
  ) {
    return 'live';
  }

  return null;
}

export function parseWebhookPayload(
  payload,
) {
  const invoiceId =
    Number(payload?.invoice_id);

  const amount =
    Number(payload?.amount);

  const finalAmount =
    Number(
      payload?.final_amount ??
        payload?.amount,
    );

  if (
    !Number.isInteger(invoiceId) ||
    !Number.isInteger(amount) ||
    !Number.isInteger(finalAmount)
  ) {
    throw new Error(
      'Invalid payment payload',
    );
  }

  return {
    invoiceId,
    amount,
    finalAmount,
    transactionId:
      payload?.transaction_id ??
      null,
    mode:
      payload?.mode ?? null,
  };
}

export async function validatePurchaseWebhook(
  db,
  env,
  parsed,
) {
  const purchase =
    await findPurchaseByInvoiceId(
      db,
      parsed.invoiceId,
    );

  if (!purchase) {
    const error =
      new Error(
        'Invoice not found',
      );

    error.status = 404;

    throw error;
  }

  if (
    purchase.status ===
    'waiting_payment'
  ) {
    const expiry =
      purchase.blupal_expires_at
        ? new Date(
            purchase.blupal_expires_at,
          ).getTime()
        : NaN;

    if (
      !Number.isFinite(expiry) ||
      expiry <= Date.now()
    ) {
      await cancelWaitingPurchase(
        db,
        purchase.id,
      );

      return {
        purchase: null,
        ignoredReason:
          'invoice_expired',
      };
    }
  }

  if (
    Number(purchase.amount) !==
    parsed.amount
  ) {
    const error =
      new Error(
        'Amount mismatch',
      );

    error.status = 400;

    throw error;
  }

  if (
    purchase.blupal_final_amount !==
      null &&
    purchase.blupal_final_amount !==
      undefined &&
    Number(
      purchase.blupal_final_amount,
    ) !== parsed.finalAmount
  ) {
    const error =
      new Error(
        'Final amount mismatch',
      );

    error.status = 400;

    throw error;
  }

  const expectedMode =
    getExpectedBlupalMode(
      env.BLUPAL_API_KEY,
    );

  if (
    expectedMode &&
    parsed.mode &&
    parsed.mode !== expectedMode
  ) {
    const error =
      new Error(
        'Mode mismatch',
      );

    error.status = 400;

    throw error;
  }

  if (
    purchase.status ===
      'approved' &&
    purchase.access_status ===
      'active'
  ) {
    return {
      purchase,
      duplicate: true,
    };
  }

  if (
    purchase.status !==
    'waiting_payment'
  ) {
    return {
      purchase: null,
      ignoredReason:
        'purchase_not_pending',
    };
  }

  return {
    purchase,
    duplicate: false,
  };
}

export async function processPaymentWebhook(
  db,
  env,
  parsed,
) {
  const validation =
    await validatePurchaseWebhook(
      db,
      env,
      parsed,
    );

  if (!validation.purchase) {
    return validation;
  }

  if (validation.duplicate) {
    return validation;
  }

  const approvedPurchase =
    await approveBlupalPurchase(
      db,
      parsed.invoiceId,
      parsed.transactionId,
      parsed.finalAmount,
      parsed.mode ??
        getExpectedBlupalMode(
          env.BLUPAL_API_KEY,
        ),
    );

  if (!approvedPurchase) {
    const error =
      new Error(
        'Could not approve purchase',
      );

    error.status = 500;

    throw error;
  }

  const walletAmountToman =
    Math.floor(
      parsed.finalAmount / 10,
    );

  if (
    !Number.isInteger(
      walletAmountToman,
    ) ||
    walletAmountToman <= 0
  ) {
    throw new Error(
      'Invalid wallet payment amount.',
    );
  }

  await settleCoursePaymentToWallet(
    env.WALLET_DB,
    approvedPurchase.telegram_id,
    walletAmountToman,
    parsed.invoiceId,
  );

  const activated =
    await activateCoursePurchase(
      db,
      env,
      approvedPurchase,
    );

  return {
    ...validation,
    purchase:
      activated.purchase,
    inviteLink:
      activated.inviteLink,
    activated: true,
  };
}

export function buildPurchaseNotification(
  finalAmount,
  activatedPurchase,
  inviteLink,
) {
  const plan =
    getCoursePlan(
      activatedPurchase.course_plan,
    );

  const planTitle =
    plan?.title ||
    'دائمی';

  const expiryText =
    activatedPurchase.expires_at
      ? new Date(
          activatedPurchase.expires_at,
        ).toLocaleString(
          'fa-IR',
        )
      : 'بدون تاریخ انقضا';

  return {
    telegramId:
      activatedPurchase.telegram_id,

    text:
      `✅ <b>پرداخت با موفقیت تأیید شد</b>\n\n` +
      `اشتراک <b>${escapeHtml(
        planTitle,
      )}</b> برای حساب شما فعال شد.\n\n` +
      `مبلغ پرداختی: <b>${Math.floor(
        finalAmount / 10,
      ).toLocaleString(
        'fa-IR',
      )} تومان</b>\n` +
      `اعتبار تا: <b>${escapeHtml(
        expiryText,
      )}</b>\n\n` +
      `لینک زیر فقط برای همین حساب Telegram صادر شده است:\n\n` +
      `<a href="${escapeHtml(
        inviteLink,
      )}">ورود به کانال خصوصی</a>`,
  };
}
