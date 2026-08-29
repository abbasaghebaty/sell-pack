/**
 * Blupal configuration
 */

export const BLUPAL_CONFIG = Object.freeze({
  MODE: 'sandbox',

  WEBHOOK_URL:
    'https://sell-pack.abbas-aghebaty.workers.dev/blupal/webhook',

  BACK_URL: null,

  // قیمت‌ها در src/config/coursePlans.js تعریف شده‌اند.
  // این مقادیر فقط برای سازگاری با کد قدیمی نگه داشته شده‌اند.
  COURSE_PRICE_RIAL: 4_500_000,
  COURSE_PRICE_INPUT: 45,

  MIN_AMOUNT_RIAL: 100_000,
});
