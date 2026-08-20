/**
 * Admin Application Keyboard
 *
 * مسیر:
 * keyboards/adminApplication.js
 */

export const ADMIN_APPLICATION_BUTTONS = Object.freeze({
  SEND_PHONE: '📱 ارسال شماره همین حساب',
  BACK: '🔙 بازگشت',
});


export function getPhoneKeyboard() {
  return {
    keyboard: [
      [
        {
          text: ADMIN_APPLICATION_BUTTONS.SEND_PHONE,
          request_contact: true,
        },
      ],
      [
        {
          text: ADMIN_APPLICATION_BUTTONS.BACK,
          style: 'danger',
        },
      ],
    ],

    resize_keyboard: true,
    is_persistent: false,
  };
}


export function getApplicationBackKeyboard() {
  return {
    keyboard: [
      [
        {
          text: ADMIN_APPLICATION_BUTTONS.BACK,
          style: 'danger',
        },
      ],
    ],

    resize_keyboard: true,
    is_persistent: false,
  };
  }
