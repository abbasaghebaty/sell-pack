/**
 * EndMark Earn Money Keyboard
 *
 * مسیر:
 * keyboards/earnMoney.js
 */

export const EARN_MONEY_BUTTONS = Object.freeze({
  APPLY_ADMIN: '📝 درخواست ثبت حساب ادمینی',
  COURSE_PURCHASED: '✅ دوره را خریداری کرده‌ام',
  BACK: '🔙 بازگشت',
});

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
    is_persistent: false,
  };
}

export function getAdminApplicationStartKeyboard() {
  return {
    keyboard: [
      [
        {
          text:
            EARN_MONEY_BUTTONS.COURSE_PURCHASED,
          style: 'success',
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
    is_persistent: false,
  };
}

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
    is_persistent: false,
  };
}

export function getAdminApplicationPhoneKeyboard() {
  return {
    keyboard: [
      [
        {
          text: '📱 ارسال شماره همین حساب',
          request_contact: true,
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
    is_persistent: false,
  };
}
