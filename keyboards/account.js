export const ACCOUNT_BUTTONS =
  Object.freeze({
    TOPUP:
      '💳 شارژ کیف پول',

    BACK:
      '🔙 بازگشت',
  });

export function getAccountKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text:
            ACCOUNT_BUTTONS.TOPUP,

          callback_data:
            'wallet_topup_start',
        },
      ],
    ],
  };
}

export function getAccountBackReplyKeyboard() {
  return {
    keyboard: [
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
