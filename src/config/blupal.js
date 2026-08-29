/**
 * Blupal configuration
 *
 * مسیر:
 * src/config/blupal.js
 *
 * API Key را اینجا قرار نده.
 *
 * Cloudflare Secret:
 *
 * BLUPAL_API_KEY
 */

export const BLUPAL_CONFIG =
  Object.freeze({
    MODE: 'sandbox',

    WEBHOOK_URL:
      'https://sell-pack.abbas-aghebaty.workers.dev/blupal/webhook',

    BACK_URL: null,

    MIN_AMOUNT_RIAL: 100_000,
  });
