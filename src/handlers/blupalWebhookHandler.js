import {
  getWalletTopupByInvoiceId,
  validateWalletTopupPayment,
  markWalletTopupPaid,
} from '../database/walletTopups.js';

import {
  creditWallet,
} from '../services/walletService.js';

import {
  sendMessage,
} from '../api/telegram.js';

import {
  processPaymentWebhook,
  parseWebhookPayload,
  buildPurchaseNotification,
} from '../services/paymentWebhookService.js';

export async function handleBlupalWebhook(
  request,
  env,
  db,
) {
  if (
    request.method !== 'POST'
  ) {
    return Response.json(
      {
        error:
          'Method Not Allowed',
      },
      {
        status: 405,
      },
    );
  }

  if (!db) {
    return Response.json(
      {
        error:
          'Database unavailable',
      },
      {
        status: 500,
      },
    );
  }

  let payload;

  try {
    payload =
      await request.json();
  } catch {
    return Response.json(
      {
        error:
          'Invalid JSON',
      },
      {
        status: 400,
      },
    );
  }

  console.log(
    'Blupal webhook received:',
    {
      event:
        payload?.event,

      status:
        payload?.status,

      invoice_id:
        payload?.invoice_id,

      amount:
        payload?.amount,

      final_amount:
        payload?.final_amount,

      mode:
        payload?.mode,
    },
  );

  if (
    payload?.event !==
      'payment.completed' ||
    payload?.status !==
      'PAID'
  ) {
    return Response.json({
      received: true,
      ignored: true,
    });
  }

  let parsed;

  try {
    parsed =
      parseWebhookPayload(
        payload,
      );
  } catch (error) {
    return Response.json(
      {
        error:
          error.message,
      },
      {
        status: 400,
      },
    );
  }

  try {
    /*
     * ---------------------------------------
     * Wallet Top-up
     * ---------------------------------------
     */

    const walletTopup =
      await getWalletTopupByInvoiceId(
        db,
        parsed.invoiceId,
      );

    if (walletTopup) {
      const validation =
        await validateWalletTopupPayment(
          db,
          parsed.invoiceId,
          parsed.finalAmount,
        );

      if (
        validation?.ignoredReason
      ) {
        return Response.json({
          received: true,
          ignored: true,
          reason:
            validation.ignoredReason,
        });
      }

      if (
        validation?.duplicate
      ) {
        return Response.json({
          received: true,
          duplicate: true,
          wallet_topup: true,
        });
      }

      const topup =
        validation.topup;

      /*
       * اول Wallet را شارژ می‌کنیم.
       *
       * اگر credit موفق نشود،
       * topup هنوز waiting_payment باقی می‌ماند
       * و webhook بعدی می‌تواند دوباره تلاش کند.
       */
      await creditWallet(
        env.WALLET_DB,
        topup.telegram_id,
        Number(
          topup.amount_toman,
        ),
        {
          type:
            'wallet_topup',

          referenceType:
            'wallet_topup',

          referenceId:
            String(
              topup.id,
            ),

          description:
            'شارژ کیف پول از طریق بلپال',
        },
      );

      /*
       * فقط بعد از موفقیت Wallet،
       * topup را paid می‌کنیم.
       */
      const markedPaid =
        await markWalletTopupPaid(
          db,
          topup.id,
          parsed.transactionId,
        );

      if (!markedPaid) {
        throw new Error(
          'Wallet was credited but top-up could not be marked as paid.',
        );
      }

      try {
        await sendMessage(
          env.TELEGRAM_BOT_TOKEN,
          topup.telegram_id,
          `✅ <b>شارژ کیف پول با موفقیت انجام شد</b>\n\n` +
            `مبلغ <b>${Number(
              topup.amount_toman,
            ).toLocaleString(
              'fa-IR',
            )} تومان</b> به کیف پول شما اضافه شد.`,
        );
      } catch (error) {
        console.error(
          'Wallet top-up notification failed:',
          error.message,
        );
      }

      return Response.json({
        received: true,
        wallet_topup: true,
      });
    }

    /*
     * ---------------------------------------
     * Course Purchase
     * ---------------------------------------
     */

    const result =
      await processPaymentWebhook(
        db,
        env,
        parsed,
      );

    if (
      result.ignoredReason
    ) {
      return Response.json({
        received: true,
        ignored: true,
        reason:
          result.ignoredReason,
      });
    }

    if (
      result.duplicate
    ) {
      return Response.json({
        received: true,
        duplicate: true,
      });
    }

    const notification =
      buildPurchaseNotification(
        parsed.finalAmount,
        result.purchase,
        result.inviteLink,
      );

    try {
      await sendMessage(
        env.TELEGRAM_BOT_TOKEN,
        notification.telegramId,
        notification.text,
      );
    } catch (error) {
      console.error(
        'Failed to send purchase notification:',
        error.message,
      );
    }

    return Response.json({
      received: true,
    });
  } catch (error) {
    console.error(
      'Blupal webhook processing failed:',
      error.message,
      error.stack,
    );

    return Response.json(
      {
        error:
          error.message ||
          'Internal server error',
      },
      {
        status:
          error.status ||
          500,
      },
    );
  }
}

export default handleBlupalWebhook;
