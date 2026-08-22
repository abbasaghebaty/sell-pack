/**
 * Blupal configuration
 *
 * مسیر:
 * src/config/blupal.js
 *
 * API Key را اینجا قرار نده.
 * کلید فقط در Cloudflare Secret با نام BLUPAL_API_KEY باشد.
 */

export const BLUPAL_CONFIG = Object.freeze({
  MODE: 'sandbox',

  WEBHOOK_URL:
    'https://sell-pack.abbas-aghebaty.workers.dev/blupal/webhook',

  BACK_URL:
    'https://example.com/back',

  // 20 => 200,000 تومان => 2,000,000 ریال
  COURSE_PRICE_INPUT: 20,

  MIN_AMOUNT_RIAL: 100000,
});
