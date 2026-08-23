/**
 * Payment message helpers
 *
 * مسیر:
 * src/utils/paymentMessage.js
 */

import {
  PAYMENT_CONFIG,
} from '../config/payment.js';


/**
 * تبدیل ریال به تومان
 *
 * 2,000,000 ریال
 * => 200,000 تومان
 */
export function rialToToman(rialAmount) {
  const value = Number(rialAmount);

  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.floor(value / 10);
}


/**
 * نمایش مبلغ به فرمت T
 *
 * T = هزار تومان
 *
 * 1,000 تومان
 * => 1T
 *
 * 200,000 تومان
 * => 200T
 *
 * 203,500 تومان
 * => 203.5T
 *
 * 2,035,000 تومان
 * => 2035T
 */
export function formatTomanCompact(rialAmount) {
  const toman = rialToToman(rialAmount);
  const compact = toman / 1000;

  if (!Number.isFinite(compact)) {
    return '0T';
  }

  if (Number.isInteger(compact)) {
    return `${compact}T`;
  }

  return `${Number(compact.toFixed(3))}T`;
}


/**
 * ساخت کیبورد پرداخت
 *
 * دکمه اول:
 * نام مالک حساب را نشان می‌دهد
 * ولی شماره کارت را کپی می‌کند.
 *
 * دکمه دوم:
 * مبلغ را به صورت T نشان می‌دهد
 * ولی مبلغ دقیق ریالی را کپی می‌کند.
 */
export function buildPaymentKeyboard(
  finalAmountRial
) {
  const cardNumber =
    String(
      PAYMENT_CONFIG.CARD_NUMBER || ''
    ).trim();

  const cardHolder =
    String(
      PAYMENT_CONFIG.CARD_HOLDER || ''
    ).trim();

  const exactAmountRial =
    Math.trunc(
      Number(finalAmountRial)
    );

  const compactAmount =
    formatTomanCompact(
      finalAmountRial
    );

  if (
    !cardNumber ||
    !cardHolder ||
    !Number.isInteger(exactAmountRial) ||
    exactAmountRial <= 0
  ) {
    throw new Error(
      'Invalid payment keyboard configuration.'
    );
  }

return {
  inline_keyboard: [
    [
      {
        text: compactAmount,
        copy_text: {
          text: String(exactAmountRial),
        },
      },
      {
        text: `👤 ${cardHolder}`,
        copy_text: {
          text: cardNumber,
        },
      },
    ],
  ],
};
}

/**
 * ساخت متن کامل فاکتور
 */
export function buildPaymentMessage({
  baseAmountRial,
  finalAmountRial,
  expiresAt = null,
}) {
  const baseAmount =
    Number(baseAmountRial);

  const finalAmount =
    Number(finalAmountRial);

  if (
    !Number.isInteger(baseAmount) ||
    !Number.isInteger(finalAmount) ||
    baseAmount <= 0 ||
    finalAmount <= 0
  ) {
    throw new Error(
      'Invalid payment amount.'
    );
  }

  if (
    finalAmount < baseAmount
  ) {
    throw new Error(
      'Final payment amount cannot be lower than base amount.'
    );
  }

  const baseCompact =
    formatTomanCompact(
      baseAmount
    );

  const finalCompact =
    formatTomanCompact(
      finalAmount
    );

  const cardNumber =
    String(
      PAYMENT_CONFIG.CARD_NUMBER || ''
    ).trim();

  const cardHolder =
    String(
      PAYMENT_CONFIG.CARD_HOLDER || ''
    ).trim();

  if (
    !cardNumber ||
    !cardHolder
  ) {
    throw new Error(
      'Payment card configuration is missing.'
    );
  }

  let expiresText = '';

  if (expiresAt) {
    expiresText =
      `\n⏳ اعتبار فاکتور: <b>${escapeHtml(expiresAt)}</b>`;
  }

  return (
    `💳 <b>خرید مستقیم دوره</b>\n\n` +

    `مبلغ دوره: <b>${baseCompact}</b>\n` +
    `مبلغ نهایی پرداخت: <b>${finalCompact}</b>\n\n` +

    `🏦 <b>اطلاعات پرداخت</b>\n\n` +

    `شماره کارت:\n` +
    `<code>${escapeHtml(cardNumber)}</code>\n\n` +

    `مالک حساب:\n` +
    `<b>${escapeHtml(cardHolder)}</b>\n\n` +

    `❌ <b>مبلغ نهایی را دقیقاً عین همین مبلغ واریز کنید.</b>\n\n` +

    `<blockquote expandable>` +
    `<b>نکته مهم پرداخت</b>\n\n` +
    `مبلغ انتقالی باید دقیقاً با مبلغ نهایی فاکتور یکسان باشد.\n` +
    `حتی اختلاف چند ریال هم ممکن است باعث شود پرداخت شما به‌صورت خودکار شناسایی نشود و خریدتان فعال نشود.\n\n` +
    `قبل از تأیید انتقال، مبلغ را دوباره بررسی کنید و فقط همان مبلغ درج‌شده در فاکتور را واریز کنید.` +
    `</blockquote>` +

    expiresText
  );
}


/**
 * Telegram HTML escape
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
