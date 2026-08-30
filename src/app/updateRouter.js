/**
 * Telegram update router.
 */

import handleCommand from '../handlers/commandHandler.js';

import handleMessage from '../handlers/subscriptionMessageHandler.js';

import {
  handleAdminApplicationCallback,
} from '../handlers/adminApplicationReviewHandler.js';

import {
  handleCourseJoinRequest,
} from '../handlers/courseAccessHandler.js';

import {
  startWalletTopup,
  cancelWalletTopupFromCallback,
} from '../handlers/walletTopupHandler.js';

export async function routeTelegramUpdate(
  update,
  env,
  db,
) {
  if (
    !update ||
    typeof update !== 'object'
  ) {
    return;
  }

  if (
    update.chat_join_request
  ) {
    try {
      await handleCourseJoinRequest(
        update.chat_join_request,
        env,
        db,
      );
    } catch (error) {
      console.error(
        'Chat join request error:',
        error.message,
        error.stack,
      );
    }

    return;
  }

  if (
    update.callback_query
  ) {
    const callback =
      update.callback_query;

    const data =
      String(
        callback.data ?? '',
      );

    /*
     * Wallet
     */
    if (
      data ===
      'wallet_topup_start'
    ) {
      await startWalletTopup(
        callback,
        env,
        db,
      );

      return;
    }

    if (
      data ===
        'wallet_topup_cancel_current' ||
      data.startsWith(
        'wallet_topup_cancel:',
      )
    ) {
      await cancelWalletTopupFromCallback(
        callback,
        env,
        db,
      );

      return;
    }

    /*
     * سایر callbackها:
     * admin review
     */
    await handleAdminApplicationCallback(
      callback,
      env,
      db,
    );

    return;
  }

  if (
    update.message
  ) {
    const message =
      update.message;

    if (
      !message.chat ||
      !message.from
    ) {
      return;
    }

    const text =
      message.text || '';

    console.log(
      `Message from ${message.chat.id}:`,
      text ||
        '[non-text message]',
    );

    if (
      text.startsWith('/')
    ) {
      await handleCommand(
        message,
        env,
        db,
      );
    } else {
      await handleMessage(
        message,
        env,
        db,
      );
    }

    return;
  }

  if (
    update.edited_message
  ) {
    return;
  }

  console.log(
    'Unsupported update:',
    Object.keys(update),
  );
}

export default routeTelegramUpdate;
