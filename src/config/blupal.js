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

  BACK_URL:
    'https://example.com/back',

  // قیمت واقعی دوره:
  // 200,000 تومان = 2,000,000 ریال
  COURSE_PRICE_RIAL: 2_000_000,

  MIN_AMOUNT_RIAL: 100_000,
});
