/**
 * Account Keyboard
 *
 * مسیر:
 * keyboards/account.js
 */

export const ACCOUNT_BUTTONS =
  Object.freeze({
    BACK: '🔙 بازگشت',
  });

export function getAccountKeyboard() {
  return {
    keyboard: [
      [
        {
          text:
            ACCOUNT_BUTTONS.BACK,
          style: 'danger',
        },
      ],
    ],
    resize_keyboard: true,
    is_persistent: false,
  };
}
