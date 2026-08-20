/**
 * EndMark Course Menu
 *
 * مسیر:
 * keyboards/courseMenu.js
 */

export const COURSE_MENU_BUTTONS = Object.freeze({
  VERIFY_ADMIN: '🔎 استعلام ادمین',
  BACK: '🔙 بازگشت',
});

export function getCourseMenuKeyboard() {
  return {
    keyboard: [
      [
        {
          text: COURSE_MENU_BUTTONS.VERIFY_ADMIN,
          style: 'primary',
        },
      ],
      [
        {
          text: COURSE_MENU_BUTTONS.BACK,
          style: 'danger',
        },
      ],
    ],
    resize_keyboard: true,
    is_persistent: false,
  };
}

export function getAdminVerificationKeyboard() {
  return {
    keyboard: [
      [
        {
          text: COURSE_MENU_BUTTONS.BACK,
          style: 'danger',
        },
      ],
    ],
    resize_keyboard: true,
    is_persistent: false,
  };
}
