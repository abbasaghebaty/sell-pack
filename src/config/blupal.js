/**
 * Blupal Configuration
 *
 * مسیر:
 * src/config/blupal.js
 *
 * نکته:
 * BLUPAL_API_KEY عمداً داخل این فایل نیست.
 * کلید باید فقط در Cloudflare Secret قرار بگیرد.
 */

export const BLUPAL_CONFIG = Object.freeze({
  MODE: 'sandbox',

  WEBHOOK_PATH: '/blupal/webhook',

  BACK_URL: 'https://example.com/back',

  MIN_AMOUNT_RIAL: 100000,
});
