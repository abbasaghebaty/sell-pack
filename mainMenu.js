/**
 * EndMark Main Menu
 *
 * مسیر:
 * keyboards/mainMenu.js
 */

export const MAIN_MENU_BUTTONS = Object.freeze({
  BUY_COURSE: '🛍 خرید دوره',
  ACCOUNT: '👤 حساب من',
  SUPPORT: '❓ راهنما و پشتیبانی',
});

export function getMainMenuKeyboard() {
  return {
    keyboard: [
      [
        {
          text: MAIN_MENU_BUTTONS.BUY_COURSE,
          style: 'primary',
        },
      ],
      [
        {
          text: MAIN_MENU_BUTTONS.ACCOUNT,
          style: 'primary',
        },
      ],
      [
        {
          text: MAIN_MENU_BUTTONS.SUPPORT,
          style: 'danger',
        },
      ],
    ],
    resize_keyboard: true,
    is_persistent: false,
  };
}
