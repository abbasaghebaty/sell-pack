/**
 * Payment message helpers
 *
 * مسیر:
 * src/utils/paymentMessage.js
 */

import { PAYMENT_CONFIG } from '../config/payment.js';

function formatNumber(value) {
  return Number(value).toLocaleString('fa-IR');
}

/**
 * تبدیل ریال به تومان
 *
 * مثال:
 * 2,000,000 ریال
 * => 200,000 تومان
 */
export function rialToToman(rialAmount) {
  return Math.floor(Number(rialAmount) / 10);
}

/**
 * نمایش مبلغ به فرمت:
 *
 * 200T
 * 2035T
 * 1T
 *
 * یعنی تقسیم تومان بر 1000.
 */
export function formatTomanCompact(rialAmount) {
  const toman = rialToToman(rialAmount);
  const compact = toman / 1000;

  if (Number.isInteger(compact)) {
    return `${compact}T`;
  }

  return `${Number(compact.toFixed(3))}T`;
}

/**
 * ساخت کیبورد پرداخت
 *
 * copy_text مستقیماً متن مشخص‌شده را
 * داخل Clipboard کاربر کپی می‌کند.
 */
export function buildPaymentKeyboard(finalAmountRial) {
  const cardNumber = PAYMENT_CONFIG.CARD_NUMBER;
  const finalToman = rialToToman(finalAmountRial);

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
          text: `👤 ${PAYMENT_CONFIG.CARD_HOLDER}`,
          callback_data: 'payment_card_holder',
        },
      ],
      [
        {
          text: `📋 کپی مبلغ ${formatTomanCompact(finalAmountRial)}`,
          copy_text: {
            text: String(finalAmountRial),
          },
        },
        {
          text: `${formatTomanCompact(finalAmountRial)}`,
          callback_data: `payment_amount_${finalAmountRial}`,
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
  const baseToman = rialToToman(baseAmountRial);
  const finalToman = rialToToman(finalAmountRial);

  const additionalToman = finalToman - baseToman;

  const baseCompact = formatTomanCompact(baseAmountRial);
  const finalCompact = formatTomanCompact(finalAmountRial);
  const additionalCompact = formatTomanCompact(
    additionalToman * 10
  );

  const expiresText = expiresAt
    ? `\n⏳ اعتبار فاکتور: <b>${escapeHtml(expiresAt)}</b>`
    : '';

  return (
    `💳 <b>خرید مستقیم دوره</b>\n\n` +

    `مبلغ دوره: <b>${baseCompact}</b> تومان\n` +
    `هزینه و افزایش فاکتور: <b>${additionalCompact}</b> تومان\n` +
    `مبلغ نهایی پرداخت: <b>${finalCompact}</b> تومان\n\n` +

    `🏦 <b>اطلاعات پرداخت</b>\n\n` +
    `شماره کارت:\n` +
    `<code>${escapeHtml(PAYMENT_CONFIG.CARD_NUMBER)}</code>\n\n` +

    `مالک حساب:\n` +
    `<b>${escapeHtml(PAYMENT_CONFIG.CARD_HOLDER)}</b>\n\n` +

    `مبلغ نهایی را دقیقاً طبق فاکتور واریز کنید.` +
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
