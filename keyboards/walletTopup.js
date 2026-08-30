/**
 * Wallet Top-up Keyboard
 *
 * مسیر:
 * keyboards/walletTopup.js
 */

export function createCancelTopupKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: '❌ لغو شارژ',
          callback_data: 'wallet_topup_cancel_current',
        },
      ],
    ],
  };
}
