/**
 * EndMark Main Menu
 *
 * مسیر:
 * keyboards/mainMenu.js
 */

export const MAIN_MENU_BUTTONS = Object.freeze({
  BUY_COURSE: '🛍 خرید دوره',
  EARN_MONEY: '💰 کسب درآمد',
  SUPPORT: '❓ راهنما و پشتیبانی',
});

export function getMainMenuKeyboard() {
  return {
    keyboard: [
      [
        {
          text: MAIN_MENU_BUTTONS.EARN_MONEY,
          style: 'success',
        },
        {
          text: MAIN_MENU_BUTTONS.BUY_COURSE,
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
