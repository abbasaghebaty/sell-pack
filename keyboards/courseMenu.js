/**
 * Course Menu Reply Keyboard
 *
 * مسیر:
 * keyboards/courseMenu.js
 *
 * فقط مسئول ساخت منوی خرید دوره و منوی استعلام ادمین است.
 */

export const COURSE_MENU_BUTTONS = Object.freeze({
  VERIFY_ADMIN: '🔎 استعلام ادمین',
  BACK: '🔙 بازگشت',
});


/**
 * منوی خرید دوره
 */
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


/**
 * منوی مخصوص زمان استعلام ادمین
 *
 * در این حالت فقط دکمه بازگشت نمایش داده می‌شود.
 */
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
