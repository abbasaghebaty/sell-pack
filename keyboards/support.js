/**
 * Support Keyboard
 *
 * مسیر:
 * keyboards/support.js
 */

export const SUPPORT_BUTTONS =
  Object.freeze({
    DIRECT:
      '📩 ارتباط مستقیم با پشتیبانی',

    ASSISTANT:
      '🤖 ربات دستیار EndMark',

    ANONYMOUS:
      '🕶 ارسال پیام ناشناس',
  });

export function getSupportKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text:
            SUPPORT_BUTTONS.DIRECT,

          url:
            'tg://user?id=7548075013',

          style:
            'primary',
        },
      ],

      [
        {
          text:
            SUPPORT_BUTTONS.ASSISTANT,

          url:
            'https://t.me/abbas_aghebaty_bot',

          style:
            'primary',
        },
      ],

      [
        {
          text:
            SUPPORT_BUTTONS.ANONYMOUS,

          url:
            'https://t.me/XBCHATBot?start=sec-hfeiahfabd',

          style:
            'success',
        },
      ],
    ],
  };
}
