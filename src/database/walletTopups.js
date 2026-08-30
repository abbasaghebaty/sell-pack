export async function createWalletTopup(
  db,
  telegramId,
  amountToman,
) {
  if (!db) {
    throw new Error(
      'D1 database is not available.',
    );
  }

  const userId =
    String(telegramId);

  const amount =
    Number(amountToman);

  if (
    !Number.isInteger(amount) ||
    amount <= 0
  ) {
    throw new Error(
      'Invalid top-up amount.',
    );
  }

  const amountRial =
    amount * 10;

  const expiresAt =
    new Date(
      Date.now() +
        20 * 60 * 1000,
    ).toISOString();

  const result =
    await db
      .prepare(`
        INSERT INTO wallet_topups (
          telegram_id,
          amount_toman,
          amount_rial,
          blupal_expires_at
        )
        VALUES (?, ?, ?, ?)
      `)
      .bind(
        userId,
        amount,
        amountRial,
        expiresAt,
      )
      .run();

  const id =
    result?.meta?.last_row_id;

  if (!id) {
    throw new Error(
      'Failed to create wallet top-up.',
    );
  }

  return {
    id,
    telegramId: userId,
    amountToman: amount,
    amountRial,
    expiresAt,
  };
}

export async function attachWalletTopupInvoice(
  db,
  topupId,
  invoice,
) {
  if (!db) {
    throw new Error(
      'D1 database is not available.',
    );
  }

  const invoiceId =
    Number(invoice?.invoice_id);

  const finalAmount =
    Number(invoice?.final_amount);

  if (
    !Number.isInteger(invoiceId) ||
    invoiceId <= 0
  ) {
    throw new Error(
      'Invalid Blupal invoice ID.',
    );
  }

  if (
    !Number.isInteger(finalAmount) ||
    finalAmount <= 0
  ) {
    throw new Error(
      'Invalid Blupal final amount.',
    );
  }

  const result =
    await db
      .prepare(`
        UPDATE wallet_topups
        SET
          blupal_invoice_id = ?,
          blupal_final_amount = ?,
          blupal_payment_link = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND status = 'waiting_payment'
      `)
      .bind(
        invoiceId,
        finalAmount,
        invoice?.payment_link ?? null,
        topupId,
      )
      .run();

  if (!result?.meta?.changes) {
    throw new Error(
      `Failed to attach invoice to wallet top-up ${topupId}.`,
    );
  }
}

export async function getWalletTopupById(
  db,
  topupId,
) {
  return db
    .prepare(`
      SELECT *
      FROM wallet_topups
      WHERE id = ?
      LIMIT 1
    `)
    .bind(topupId)
    .first();
}

export async function getWalletTopupByInvoiceId(
  db,
  invoiceId,
) {
  return db
    .prepare(`
      SELECT *
      FROM wallet_topups
      WHERE blupal_invoice_id = ?
      LIMIT 1
    `)
    .bind(Number(invoiceId))
    .first();
}

export async function cancelWalletTopup(
  db,
  topupId,
) {
  await db
    .prepare(`
      UPDATE wallet_topups
      SET
        status = 'cancelled',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND status = 'waiting_payment'
    `)
    .bind(topupId)
    .run();
}

export async function expireWalletTopup(
  db,
  topupId,
) {
  await db
    .prepare(`
      UPDATE wallet_topups
      SET
        status = 'expired',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND status = 'waiting_payment'
    `)
    .bind(topupId)
    .run();
}

export async function validateWalletTopupPayment(
  db,
  invoiceId,
  amount,
  finalAmount,
) {
  const topup =
    await getWalletTopupByInvoiceId(
      db,
      invoiceId,
    );

  if (!topup) {
    return null;
  }

  if (
    topup.status === 'paid'
  ) {
    return {
      topup,
      duplicate: true,
    };
  }

  if (
    topup.status !==
    'waiting_payment'
  ) {
    return {
      topup: null,
      ignoredReason:
        'topup_not_pending',
    };
  }

  if (
    Number(topup.amount_rial) !==
    Number(amount)
  ) {
    const error =
      new Error(
        'Wallet top-up amount mismatch.',
      );

    error.status = 400;

    throw error;
  }

  if (
    Number(topup.blupal_final_amount) !==
    Number(finalAmount)
  ) {
    const error =
      new Error(
        'Wallet top-up final amount mismatch.',
      );

    error.status = 400;

    throw error;
  }

  const expiry =
    topup.blupal_expires_at
      ? new Date(
          topup.blupal_expires_at,
        ).getTime()
      : NaN;

  if (
    Number.isFinite(expiry) &&
    expiry <= Date.now()
  ) {
    await expireWalletTopup(
      db,
      topup.id,
    );

    return {
      topup: null,
      ignoredReason:
        'topup_expired',
    };
  }

  return {
    topup,
    duplicate: false,
  };
}

/**
 * نتیجه:
 * updated
 * already_paid
 * false
 */
export async function markWalletTopupPaid(
  db,
  topupId,
  transactionId,
) {
  const result =
    await db
      .prepare(`
        UPDATE wallet_topups
        SET
          status = 'paid',
          transaction_id = ?,
          paid_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND status = 'waiting_payment'
      `)
      .bind(
        transactionId ?? null,
        topupId,
      )
      .run();

  if (
    result?.meta?.changes
  ) {
    return 'updated';
  }

  const current =
    await getWalletTopupById(
      db,
      topupId,
    );

  if (
    current?.status ===
    'paid'
  ) {
    return 'already_paid';
  }

  return false;
}
