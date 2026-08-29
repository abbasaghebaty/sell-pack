/**
 * Payment message helpers
 *
 * مسیر:
 * src/utils/paymentMessage.js
 */

import {
  PAYMENT_CONFIG,
} from '../config/payment.js';

export function rialToToman(
  rialAmount
) {
  const value =
    Number(rialAmount);

  if (
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return Math.floor(
    value / 10
  );
}

export function formatTomanCompact(
  rialAmount
) {
  const toman =
    rialToToman(
      rialAmount
    );

  const compact =
    toman / 1000;

  if (
    !Number.isFinite(
      compact
    )
  ) {
    return '0T';
  }

  if (
    Number.isInteger(
      compact
    )
  ) {
    return `${compact}T`;
  }

  return `${Number(
    compact.toFixed(3)
  )}T`;
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
 * کیبورد پرداخت
 *
 * اگر Blupal لینک پرداخت بدهد،
 * دکمه مستقیم ورود به پرداخت نمایش داده می‌شود.
 *
 * اگر لینک ندهد،
 * اطلاعات کارت نمایش داده می‌شود.
 */
export function buildPaymentKeyboard(
  options
) {
  const finalAmountRial =
    typeof options ===
    'object'
      ? options.finalAmountRial
      : options;

  const paymentLink =
    typeof options ===
    'object'
      ? options.paymentLink ??
        null
      : null;

  const cardNumber =
    typeof options ===
    'object'
      ? (
          options.cardNumber ??
          PAYMENT_CONFIG.CARD_NUMBER
        )
      : PAYMENT_CONFIG.CARD_NUMBER;

  const cardHolder =
    PAYMENT_CONFIG.CARD_HOLDER;

  const exactAmountRial =
    Math.trunc(
      Number(
        finalAmountRial
      )
    );

  if (
    !Number.isInteger(
      exactAmountRial
    ) ||
    exactAmountRial <= 0
  ) {
    throw new Error(
      'Invalid payment amount.'
    );
  }

  const buttons = [];

  /*
   * لینک واقعی پرداخت Blupal
   */
  if (
    typeof paymentLink ===
      'string' &&
    paymentLink.trim()
  ) {
    buttons.push([
      {
        text:
          '💳 پرداخت / مشاهده فاکتور',
        url:
          paymentLink.trim(),
      },
    ]);
  }

  /*
   * مبلغ برای Copy
   */
  buttons.push([
    {
      text:
        formatTomanCompact(
          exactAmountRial
        ),

      copy_text: {
        text:
          String(
            exactAmountRial
          ),
      },
    },
  ]);

  /*
   * کارت در صورت وجود
   */
  if (
    cardNumber &&
    cardHolder
  ) {
    buttons.push([
      {
        text:
          `👤 ${cardHolder}`,

        copy_text: {
          text:
            String(
              cardNumber
            ),
        },
      },
    ]);
  }

  return {
    inline_keyboard:
      buttons,
  };
}

export function buildPaymentMessage({
  baseAmountRial,
  finalAmountRial,
  expiresAt = null,
  paymentLink = null,
  cardNumber = null,
}) {
  const baseAmount =
    Number(
      baseAmountRial
    );

  const finalAmount =
    Number(
      finalAmountRial
    );

  if (
    !Number.isInteger(
      baseAmount
    ) ||
    !Number.isInteger(
      finalAmount
    ) ||
    baseAmount <= 0 ||
    finalAmount <= 0
  ) {
    throw new Error(
      'Invalid payment amount.'
    );
  }

  const baseToman =
    rialToToman(
      baseAmount
    );

  const finalToman =
    rialToToman(
      finalAmount
    );

  const card =
    cardNumber ??
    PAYMENT_CONFIG.CARD_NUMBER;

  const cardHolder =
    PAYMENT_CONFIG.CARD_HOLDER;

  let text =
    `💳 <b>فاکتور پرداخت</b>\n\n` +

    `مبلغ دوره: <b>${baseToman.toLocaleString(
      'fa-IR'
    )} تومان</b>\n` +

    `مبلغ نهایی: <b>${finalToman.toLocaleString(
      'fa-IR'
    )} تومان</b>\n\n`;

  if (
    paymentLink
  ) {
    text +=
      `🔗 <b>لینک پرداخت Blupal برای شما ایجاد شد.</b>\n` +
      `از دکمه «پرداخت / مشاهده فاکتور» استفاده کنید.\n\n`;
  }

  if (
    card &&
    cardHolder
  ) {
    text +=
      `🏦 <b>اطلاعات پرداخت</b>\n\n` +
      `شماره کارت:\n` +
      `<code>${escapeHtml(
        card
      )}</code>\n\n` +
      `مالک حساب:\n` +
      `<b>${escapeHtml(
        cardHolder
      )}</b>\n\n`;
  }

  text +=
    `❌ <b>مبلغ نهایی را دقیقاً مطابق فاکتور پرداخت کنید.</b>`;

  if (
    expiresAt
  ) {
    text +=
      `\n\n⏳ اعتبار فاکتور: <b>${escapeHtml(
        expiresAt
      )}</b>`;
  }

  return text;
}
