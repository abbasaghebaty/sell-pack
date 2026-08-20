/**
 * Earn Money Keyboard
 *
 * مسیر:
 * keyboards/earnMoney.js
 */

export const EARN_MONEY_BUTTONS = Object.freeze({
  APPLY_ADMIN: '📝 درخواست ثبت حساب ادمینی',
  COURSE_PURCHASED: '✅ دوره را خریداری کرده‌ام',
  BACK: '🔙 بازگشت',
});


/**
 * منوی کسب درآمد
 */
export function getEarnMoneyKeyboard() {
  return {
    keyboard: [
      [
        {
          text: EARN_MONEY_BUTTONS.APPLY_ADMIN,
          style: 'primary',
        },
      ],
      [
        {
          text: EARN_MONEY_BUTTONS.BACK,
          style: 'danger',
        },
      ],
    ],
    resize_keyboard: true,
  };
}


/**
 * بعد از زدن درخواست ثبت حساب
 */
export function getAdminApplicationStartKeyboard() {
  return {
    keyboard: [
      [
        {
          text: EARN_MONEY_BUTTONS.COURSE_PURCHASED,
          style: 'primary',
        },
      ],
      [
        {
          text: EARN_MONEY_BUTTONS.BACK,
          style: 'danger',
        },
      ],
    ],
    resize_keyboard: true,
  };
}


/**
 * مرحله دریافت نام و نام خانوادگی
 */
export function getAdminApplicationBackKeyboard() {
  return {
    keyboard: [
      [
        {
          text: EARN_MONEY_BUTTONS.BACK,
          style: 'danger',
        },
      ],
    ],
    resize_keyboard: true,
  };
}


/**
 * مرحله دریافت شماره تلفن
 */
export function getAdminApplicationPhoneKeyboard() {
  return {
    keyboard: [
      [
        {
          text: '📱 ارسال شماره همین حساب',
          request_contact: true,
        },
      ],
      [
        {
          text: EARN_MONEY_BUTTONS.BACK,
          style: 'danger',
        },
      ],
    ],
    resize_keyboard: true,
  };
}
