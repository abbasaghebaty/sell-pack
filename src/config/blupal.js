/**
 * Blupal configuration
 *
 * مسیر:
 * src/config/blupal.js
 *
 * API Key را اینجا قرار نده.
 * کلید فقط باید در Cloudflare Secret با نام:
 *
 * BLUPAL_API_KEY
 *
 * قرار داشته باشد.
 */

export const BLUPAL_CONFIG = Object.freeze({
  MODE: 'sandbox',

  WEBHOOK_URL:
    'https://sell-pack.abbas-aghebaty.workers.dev/blupal/webhook',

  // Callback/Back URL فقط برای برگشت کاربر از صفحه پرداخت است.
  // تأیید واقعی پرداخت از طریق Webhook انجام می‌شود.
  BACK_URL: null,

  // قیمت واقعی دوره:
  // 200,000 تومان = 2,000,000 ریال
  COURSE_PRICE_RIAL: 2_000_000,

  // messageHandler از این مقدار برای createPurchase استفاده می‌کند.
  //
  // واحد این مقدار = 10,000 تومان
  //
  // 20 × 10,000 = 200,000 تومان
  // 200,000 تومان = 2,000,000 ریال
  COURSE_PRICE_INPUT: 20,

  MIN_AMOUNT_RIAL: 100_000,
});
