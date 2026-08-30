/**
 * Central Wallet Service
 *
 * Wallet data lives in the shared WALLET_DB.
 *
 * واحد پول کیف پول:
 * تومان
 */

function validateUserId(
  telegramUserId,
) {
  if (
    telegramUserId === undefined ||
    telegramUserId === null ||
    String(
      telegramUserId,
    ).trim() === ''
  ) {
    throw new Error(
      'Telegram user ID is required.',
    );
  }

  return String(
    telegramUserId,
  );
}

function validateAmount(
  amount,
) {
  const value =
    Number(amount);

  if (
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new Error(
      'Wallet amount must be a positive integer.',
    );
  }

  return value;
}

function hasUsableReference(
  referenceType,
  referenceId,
) {
  return Boolean(
    referenceType &&
    referenceId !== null &&
    referenceId !== undefined,
  );
}

function isDuplicateConstraint(
  error,
) {
  const message =
    String(
      error?.message || '',
    ).toLowerCase();

  return (
    message.includes(
      'unique constraint',
    ) ||
    message.includes(
      'constraint failed',
    ) ||
    message.includes(
      'is not unique',
    )
  );
}

async function transactionExists(
  walletDb,
  telegramUserId,
  type,
  referenceType,
  referenceId,
) {
  if (
    !hasUsableReference(
      referenceType,
      referenceId,
    )
  ) {
    return false;
  }

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
        String(
          telegramUserId,
        ),
        type,
        String(
          referenceType,
        ),
        String(
          referenceId,
        ),
      )
      .first();

  return Boolean(result);
}

export async function ensureWalletAccount(
  walletDb,
  telegramUserId,
) {
  if (!walletDb) {
    throw new Error(
      'Wallet database is not available.',
    );
  }

  const userId =
    validateUserId(
      telegramUserId,
    );

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
    validateUserId(
      telegramUserId,
    );

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
 *
 * اگر reference یکتا وجود داشته باشد،
 * عملیات idempotent است.
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
    throw new Error(
      'Wallet database is not available.',
    );
  }

  const userId =
    validateUserId(
      telegramUserId,
    );

  const value =
    validateAmount(
      amount,
    );

  const hasReference =
    hasUsableReference(
      referenceType,
      referenceId,
    );

  /*
   * اگر همین تراکنش قبلاً ثبت شده،
   * دوباره موجودی اضافه نمی‌کنیم.
   */
  if (
    hasReference &&
    await transactionExists(
      walletDb,
      userId,
      type,
      referenceType,
      referenceId,
    )
  ) {
    return getWalletAccount(
      walletDb,
      userId,
    );
  }

  /*
   * اطمینان از وجود حساب
   */
  await ensureWalletAccount(
    walletDb,
    userId,
  );

  const statements = [
    walletDb
      .prepare(`
        UPDATE wallet_accounts
        SET
          balance = balance + ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE telegram_user_id = ?
      `)
      .bind(
        value,
        userId,
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

  try {
    await walletDb.batch(
      statements,
    );
  } catch (error) {
    /*
     * اگر دو webhook همزمان برسند،
     * unique index اجازه duplicate نمی‌دهد.
     *
     * در این حالت اگر تراکنش قبلاً ساخته شده،
     * عملیات را موفق در نظر می‌گیریم.
     */
    if (
      hasReference &&
      isDuplicateConstraint(error) &&
      await transactionExists(
        walletDb,
        userId,
        type,
        referenceType,
        referenceId,
      )
    ) {
      return getWalletAccount(
        walletDb,
        userId,
      );
    }

    throw error;
  }

  return getWalletAccount(
    walletDb,
    userId,
  );
}

/**
 * کاهش موجودی
 *
 * اگر reference یکتا وجود داشته باشد،
 * عملیات idempotent است.
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
    throw new Error(
      'Wallet database is not available.',
    );
  }

  const userId =
    validateUserId(
      telegramUserId,
    );

  const value =
    validateAmount(
      amount,
    );

  const hasReference =
    hasUsableReference(
      referenceType,
      referenceId,
    );

  /*
   * جلوگیری از برداشت دوباره
   */
  if (
    hasReference &&
    await transactionExists(
      walletDb,
      userId,
      type,
      referenceType,
      referenceId,
    )
  ) {
    return getWalletAccount(
      walletDb,
      userId,
    );
  }

  await ensureWalletAccount(
    walletDb,
    userId,
  );

  const statements = [
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

  try {
    const results =
      await walletDb.batch(
        statements,
      );

    const updateResult =
      results?.[0];

    if (
      !updateResult?.meta?.changes
    ) {
      throw new Error(
        'Insufficient wallet balance.',
      );
    }
  } catch (error) {
    /*
     * در صورت duplicate همزمان،
     * اگر ledger قبلاً ساخته شده،
     * برداشت را دوباره انجام نمی‌دهیم.
     */
    if (
      hasReference &&
      isDuplicateConstraint(error) &&
      await transactionExists(
        walletDb,
        userId,
        type,
        referenceType,
        referenceId,
      )
    ) {
      return getWalletAccount(
        walletDb,
        userId,
      );
    }

    throw error;
  }

  return getWalletAccount(
    walletDb,
    userId,
  );
}

/**
 * تسویه پرداخت دوره
 *
 * ساختار:
 *
 * payment_credit  +
 * course_purchase -
 *
 * هر دو با reference یکتا ثبت می‌شوند.
 *
 * در نتیجه webhook تکراری
 * باعث تغییر دوباره موجودی نمی‌شود.
 */
export async function settleCoursePaymentToWallet(
  walletDb,
  telegramUserId,
  amountToman,
  invoiceId,
) {
  if (!walletDb) {
    throw new Error(
      'Wallet database is not available.',
    );
  }

  const userId =
    validateUserId(
      telegramUserId,
    );

  const amount =
    validateAmount(
      amountToman,
    );

  const referenceType =
    'course_payment';

  const referenceId =
    String(
      invoiceId,
    );

  /*
   * مرحله اول:
   * ثبت مبلغ پرداخت‌شده
   */
  const creditExists =
    await transactionExists(
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
        type:
          'payment_credit',

        referenceType,

        referenceId,

        description:
          'شارژ کیف پول بابت پرداخت دوره',
      },
    );
  }

  /*
   * مرحله دوم:
   * پرداخت هزینه دوره از همان Wallet
   */
  const debitExists =
    await transactionExists(
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
        type:
          'course_purchase',

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
