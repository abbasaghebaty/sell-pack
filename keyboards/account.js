/**
 * Account Keyboard
 *
 * مسیر:
 * keyboards/account.js
 */

export const ACCOUNT_BUTTONS = Object.freeze({
  TOPUP: '💳 شارژ کیف پول',
  BACK: '🔙 بازگشت',
});

export function getAccountKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: ACCOUNT_BUTTONS.TOPUP,
          callback_data: 'wallet_topup_start',
        },
      ],
      [
        {
          text: ACCOUNT_BUTTONS.BACK,
          callback_data: 'account_back',
        },
      ],
    ],
  };
}

export function getWalletTopupInputKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: '❌ لغو',
          callback_data: 'wallet_topup_cancel_current',
        },
      ],
    ],
  };
}
