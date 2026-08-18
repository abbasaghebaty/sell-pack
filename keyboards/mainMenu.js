export function getMainMenuKeyboard() {
  return {
    keyboard: [
      [
        {
          text: MAIN_MENU_BUTTONS.EARN_MONEY,
          style: 'primary',
        },
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
        {
          text: MAIN_MENU_BUTTONS.MY_COURSES,
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
  };
}
