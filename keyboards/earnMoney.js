/**
 * EndMark Earn Money Keyboard
 *
 * مسیر:
 * keyboards/earnMoney.js
 */

export const EARN_MONEY_BUTTONS = Object.freeze({
  GET_BANNER: '🖼 دریافت بنر',
  BACK: '🔙',
});

export function getEarnMoneyKeyboard() {
  return {
    keyboard: [
      [
        {
          text: EARN_MONEY_BUTTONS.GET_BANNER,
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
    is_persistent: true,
  };
}
