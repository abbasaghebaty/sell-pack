export const ACCOUNT_BUTTONS = Object.freeze({
  EARN_MONEY:
    '💰 کسب درآمد',

  BACK:
    '🔙',
});

export function getAccountKeyboard() {
  return {
    keyboard: [
      [
        {
          text:
            ACCOUNT_BUTTONS.EARN_MONEY,

          style:
            'success',
        },
      ],
      [
        {
          text:
            ACCOUNT_BUTTONS.BACK,

          style:
            'danger',
        },
      ],
    ],

    resize_keyboard: true,

    is_persistent: true,
  };
}
