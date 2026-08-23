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
 * Telegram copy_text را مستقیماً در Clipboard
 * کاربر قرار می‌دهد.
 */
export function buildPaymentKeyboard(finalAmountRial) {
  const cardNumber =
    String(PAYMENT_CONFIG.CARD_NUMBER || '').trim();

  const cardHolder =
    String(PAYMENT_CONFIG.CARD_HOLDER || '').trim();

  const exactAmountRial =
    Math.trunc(Number(finalAmountRial));

  const compactAmount =
    formatTomanCompact(finalAmountRial);

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
          text: '📋 کپی شماره کارت',
          copy_text: {
            text: cardNumber,
          },
        },
        {
          text: `👤 ${cardHolder}`,
          copy_text: {
            text: cardHolder,
          },
        },
      ],

      [
        {
          text: '📋 کپی مبلغ',
          copy_text: {
            text: String(exactAmountRial),
          },
        },
        {
          text: compactAmount,
          copy_text: {
            text: String(exactAmountRial),
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

  if (finalAmount < baseAmount) {
    throw new Error(
      'Final payment amount cannot be lower than base amount.'
    );
  }

  const baseToman =
    rialToToman(baseAmount);

  const finalToman =
    rialToToman(finalAmount);

  const extraToman =
    finalToman - baseToman;

  const baseCompact =
    formatTomanCompact(baseAmount);

  const extraCompact =
    formatTomanCompact(
      extraToman * 10
    );

  const finalCompact =
    formatTomanCompact(finalAmount);

  const cardNumber =
    String(PAYMENT_CONFIG.CARD_NUMBER || '').trim();

  const cardHolder =
    String(PAYMENT_CONFIG.CARD_HOLDER || '').trim();

  if (!cardNumber || !cardHolder) {
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
    `هزینه و کارمزد: <b>${extraCompact}</b>\n` +
    `مبلغ نهایی پرداخت: <b>${finalCompact}</b>\n\n` +

    `🏦 <b>اطلاعات پرداخت</b>\n\n` +

    `شماره کارت:\n` +
    `<code>${escapeHtml(cardNumber)}</code>\n\n` +

    `مالک حساب:\n` +
    `<b>${escapeHtml(cardHolder)}</b>\n\n` +

    `مبلغ نهایی را دقیقاً طبق همین فاکتور واریز کنید.` +

    expiresText
  );
}


function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
