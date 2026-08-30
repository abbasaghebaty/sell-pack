/**
 * Central Wallet Service
 *
 * Wallet data lives in the shared WALLET_DB.
 *
 * واحد پول کیف پول:
 * تومان
 */

function validateUserId(telegramUserId) {
  if (
    telegramUserId === undefined ||
    telegramUserId === null ||
    String(telegramUserId).trim() === ''
  ) {
    throw new Error('Telegram user ID is required.');
  }

  return String(telegramUserId);
}

function validateAmount(amount) {
  const value = Number(amount);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('Wallet amount must be a positive integer.');
  }

  return value;
}

export async function ensureWalletAccount(
  walletDb,
  telegramUserId,
) {
  if (!walletDb) {
    throw new Error('Wallet database is not available.');
  }

  const userId =
    validateUserId(telegramUserId);

  await walletDb
    .prepare(`
      INSERT OR IGNORE INTO wallet_accounts (
        telegram_user_id,
        balance
      )
      VALUES (?, 0)
    `)
    .bind(userId)
    .run();

  return getWalletAccount(
    walletDb,
    userId,
  );
}

export async function getWalletAccount(
  walletDb,
  telegramUserId,
) {
  if (!walletDb) {
    return null;
  }

  const userId =
    validateUserId(telegramUserId);

  return walletDb
    .prepare(`
      SELECT
        id,
        telegram_user_id,
        balance,
        created_at,
        updated_at
      FROM wallet_accounts
      WHERE telegram_user_id = ?
      LIMIT 1
    `)
    .bind(userId)
    .first();
}

export async function getWalletBalance(
  walletDb,
  telegramUserId,
) {
  const account =
    await ensureWalletAccount(
      walletDb,
      telegramUserId,
    );

  return Number(
    account?.balance || 0,
  );
}

/**
 * افزایش موجودی
 */
export async function creditWallet(
  walletDb,
  telegramUserId,
  amount,
  {
    type = 'credit',
    referenceType = null,
    referenceId = null,
    description = null,
  } = {},
) {
  if (!walletDb) {
    throw new Error('Wallet database is not available.');
  }

  const userId =
    validateUserId(telegramUserId);

  const value =
    validateAmount(amount);

  const statements = [
    walletDb
      .prepare(`
        INSERT OR IGNORE INTO wallet_accounts (
          telegram_user_id,
          balance
        )
        VALUES (?, 0)
      `)
      .bind(userId),

    walletDb
      .prepare(`
        UPDATE wallet_accounts
        SET
          balance = balance + ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE telegram_user_id = ?
      `)
      .bind(value, userId),

    walletDb
      .prepare(`
        INSERT INTO wallet_transactions (
          telegram_user_id,
          type,
          amount,
          balance_before,
          balance_after,
          reference_type,
          reference_id,
          description
        )
        SELECT
          telegram_user_id,
          ?,
          ?,
          balance - ?,
          balance,
          ?,
          ?,
          ?
        FROM wallet_accounts
        WHERE telegram_user_id = ?
          AND changes() > 0
      `)
      .bind(
        type,
        value,
        value,
        referenceType,
        referenceId,
        description,
        userId,
      ),
  ];

  const results =
    await walletDb.batch(
      statements,
    );

  const updateResult =
    results?.[1];

  if (
    !updateResult?.meta?.changes
  ) {
    throw new Error(
      'Wallet credit failed.',
    );
  }

  return getWalletAccount(
    walletDb,
    userId,
  );
}

/**
 * کاهش موجودی
 */
export async function debitWallet(
  walletDb,
  telegramUserId,
  amount,
  {
    type = 'debit',
    referenceType = null,
    referenceId = null,
    description = null,
  } = {},
) {
  if (!walletDb) {
    throw new Error('Wallet database is not available.');
  }

  const userId =
    validateUserId(telegramUserId);

  const value =
    validateAmount(amount);

  const statements = [
    walletDb
      .prepare(`
        INSERT OR IGNORE INTO wallet_accounts (
          telegram_user_id,
          balance
        )
        VALUES (?, 0)
      `)
      .bind(userId),

    walletDb
      .prepare(`
        UPDATE wallet_accounts
        SET
          balance = balance - ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE telegram_user_id = ?
          AND balance >= ?
      `)
      .bind(
        value,
        userId,
        value,
      ),

    walletDb
      .prepare(`
        INSERT INTO wallet_transactions (
          telegram_user_id,
          type,
          amount,
          balance_before,
          balance_after,
          reference_type,
          reference_id,
          description
        )
        SELECT
          telegram_user_id,
          ?,
          ?,
          balance + ?,
          balance,
          ?,
          ?,
          ?
        FROM wallet_accounts
        WHERE telegram_user_id = ?
          AND changes() > 0
      `)
      .bind(
        type,
        -value,
        value,
        referenceType,
        referenceId,
        description,
        userId,
      ),
  ];

  const results =
    await walletDb.batch(
      statements,
    );

  const updateResult =
    results?.[1];

  if (
    !updateResult?.meta?.changes
  ) {
    throw new Error(
      'Insufficient wallet balance.',
    );
  }

  return getWalletAccount(
    walletDb,
    userId,
  );
}

async function hasTransaction(
  walletDb,
  telegramUserId,
  type,
  referenceType,
  referenceId,
) {
  const result =
    await walletDb
      .prepare(`
        SELECT id
        FROM wallet_transactions
        WHERE telegram_user_id = ?
          AND type = ?
          AND reference_type = ?
          AND reference_id = ?
        LIMIT 1
      `)
      .bind(
        String(telegramUserId),
        type,
        referenceType,
        String(referenceId),
      )
      .first();

  return Boolean(result);
}

/**
 * تسویه پرداخت دوره در کیف پول
 *
 * یک بار پول وارد کیف پول می‌شود
 * و بلافاصله همان مبلغ بابت خرید دوره خارج می‌شود.
 *
 * عملیات با reference یکتا idempotent است.
 */
export async function settleCoursePaymentToWallet(
  walletDb,
  telegramUserId,
  amountToman,
  invoiceId,
) {
  const userId =
    validateUserId(telegramUserId);

  const amount =
    validateAmount(amountToman);

  const referenceType =
    'course_payment';

  const referenceId =
    String(invoiceId);

  const creditExists =
    await hasTransaction(
      walletDb,
      userId,
      'payment_credit',
      referenceType,
      referenceId,
    );

  if (!creditExists) {
    await creditWallet(
      walletDb,
      userId,
      amount,
      {
        type: 'payment_credit',
        referenceType,
        referenceId,
        description:
          'شارژ کیف پول بابت پرداخت دوره',
      },
    );
  }

  const debitExists =
    await hasTransaction(
      walletDb,
      userId,
      'course_purchase',
      referenceType,
      referenceId,
    );

  if (!debitExists) {
    await debitWallet(
      walletDb,
      userId,
      amount,
      {
        type: 'course_purchase',
        referenceType,
        referenceId,
        description:
          'پرداخت هزینه دوره از کیف پول',
      },
    );
  }

  return getWalletAccount(
    walletDb,
    userId,
  );
}
