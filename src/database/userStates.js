/**
 * User States Database
 *
 * مسیر:
 * src/database/userStates.js
 *
 * جدول:
 * user_states
 */

export const USER_STATES = Object.freeze({
  IDLE:
    'idle',

  WAITING_FOR_ADMIN_VERIFICATION:
    'waiting_for_admin_verification',

  WAITING_FOR_WALLET_TOPUP_AMOUNT:
    'waiting_for_wallet_topup_amount',

  WAITING_FOR_ADMIN_APPLICATION_CONFIRMATION:
    'waiting_for_admin_application_confirmation',

  WAITING_FOR_ADMIN_APPLICATION_FIRST_NAME:
    'waiting_for_admin_application_first_name',

  WAITING_FOR_ADMIN_APPLICATION_LAST_NAME:
    'waiting_for_admin_application_last_name',

  WAITING_FOR_ADMIN_APPLICATION_PHONE:
    'waiting_for_admin_application_phone',

  WAITING_FOR_ADMIN_REJECTION_REASON:
    'waiting_for_admin_rejection_reason',
});

export async function getUserState(
  db,
  telegramId,
) {
  if (!db) {
    throw new Error(
      'D1 database is not available',
    );
  }

  const result =
    await db
      .prepare(`
        SELECT
          telegram_id,
          state,
          data,
          created_at,
          updated_at
        FROM user_states
        WHERE telegram_id = ?
        LIMIT 1
      `)
      .bind(telegramId)
      .first();

  if (!result) {
    return null;
  }

  let data = {};

  try {
    data =
      result.data
        ? JSON.parse(result.data)
        : {};
  } catch (error) {
    console.error(
      'Failed to parse user state data:',
      error.message,
    );
  }

  return {
    telegramId:
      result.telegram_id,

    state:
      result.state,

    data,

    createdAt:
      result.created_at,

    updatedAt:
      result.updated_at,
  };
}

export async function setUserState(
  db,
  telegramId,
  state,
  data = {},
) {
  if (!db) {
    throw new Error(
      'D1 database is not available',
    );
  }

  if (!telegramId) {
    throw new Error(
      'Telegram ID is required',
    );
  }

  if (!state) {
    throw new Error(
      'State is required',
    );
  }

  await db
    .prepare(`
      INSERT INTO user_states (
        telegram_id,
        state,
        data
      )
      VALUES (?, ?, ?)

      ON CONFLICT(telegram_id)
      DO UPDATE SET
        state = excluded.state,
        data = excluded.data,
        updated_at = CURRENT_TIMESTAMP
    `)
    .bind(
      telegramId,
      state,
      JSON.stringify(
        data ?? {},
      ),
    )
    .run();

  return {
    telegramId,
    state,
    data,
  };
}

export async function updateUserStateData(
  db,
  telegramId,
  data = {},
) {
  if (!db) {
    throw new Error(
      'D1 database is not available',
    );
  }

  const current =
    await getUserState(
      db,
      telegramId,
    );

  if (!current) {
    throw new Error(
      'User state does not exist',
    );
  }

  const mergedData = {
    ...(current.data ?? {}),
    ...(data ?? {}),
  };

  await db
    .prepare(`
      UPDATE user_states
      SET
        data = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE telegram_id = ?
    `)
    .bind(
      JSON.stringify(
        mergedData,
      ),
      telegramId,
    )
    .run();

  return {
    telegramId,
    state:
      current.state,
    data:
      mergedData,
  };
}

export async function clearUserState(
  db,
  telegramId,
) {
  if (!db) {
    return;
  }

  await db
    .prepare(`
      DELETE FROM user_states
      WHERE telegram_id = ?
    `)
    .bind(telegramId)
    .run();
}

export async function clearAllUserStates(
  db,
) {
  if (!db) {
    return;
  }

  await db
    .prepare(`
      DELETE FROM user_states
    `)
    .run();
}
