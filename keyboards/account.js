export const ACCOUNT_BUTTONS =
  Object.freeze({
    BACK: '🔙 بازگشت',
    TOPUP: '💳 شارژ کیف پول',
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
      [
        {
          text:
            ACCOUNT_BUTTONS.BACK,
          callback_data:
            'account_back',
        },
      ],
    ],
  };
}
