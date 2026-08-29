/**
 * Payment configuration
 *
 * مسیر:
 * src/config/payment.js
 *
 * اطلاعات کارت ثابت است و ارتباطی با Blupal ندارد.
 */

export const PAYMENT_CONFIG = Object.freeze({
  CARD_NUMBER: '6219861808375991',
  CARD_HOLDER: 'مهدی عاقبتی',

  // هر فاکتور پرداخت‌نشده در سیستم ما فقط ۲۰ دقیقه معتبر است.
  PENDING_INVOICE_TTL_MINUTES: 20,
});
