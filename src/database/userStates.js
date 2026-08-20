/**
 * User States Database
 *
 * مسیر:
 * src/database/userStates.js
 *
 * مسئول:
 * - نگهداری State موقت کاربران
 * - نگهداری داده‌های موقت مربوط به State
 */

export const USER_STATES = Object.freeze({
  WAITING_FOR_ADMIN_VERIFICATION:
    'waiting_for_admin_verification',

  WAITING_FOR_ADMIN_APPLICATION_CONFIRMATION:
    'waiting_for_admin_application_confirmation',

  WAITING_FOR_ADMIN_APPLICATION_FIRST_NAME:
    'waiting_for_admin_application_first_name',

  WAITING_FOR_ADMIN_APPLICATION_LAST_NAME:
    'waiting_for_admin_application_last_name',

  WAITING_FOR_ADMIN_APPLICATION_PHONE:
    'waiting_for_admin_application_phone',
});


function serializeState(state, data = {}) {
  return JSON.stringify({
    state,
    data: data && typeof data === 'object'
      ? data
      : {},
  });
}


function deserializeState(value) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);

    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.state === 'string'
    ) {
      return {
        state: parsed.state,
        data:
          parsed.data &&
          typeof parsed.data === 'object'
            ? parsed.data
            : {},
      };
    }
  } catch {
    /*
     * برای سازگاری با Stateهای قدیمی
     * که فقط به صورت string ذخیره شده‌اند.
     */
  }

  return {
    state: value,
    data: {},
  };
}


/**
 * ذخیره یا بروزرسانی State
 */
export async function setUserState(
  db,
  userId,
  state,
  data = {}
) {
  if (!db) {
    throw new Error('Database is not available');
  }

  if (
    userId === undefined ||
    userId === null
  ) {
    throw new Error('User ID is required');
  }

  if (!state) {
    throw new Error('State is required');
  }

  const serializedState =
    serializeState(state, data);

  await db
    .prepare(`
      INSERT INTO user_states (
        user_id,
        state
      )
      VALUES (?, ?)

      ON CONFLICT(user_id)
      DO UPDATE SET
        state = excluded.state,
        updated_at = CURRENT_TIMESTAMP
    `)
    .bind(
      userId,
      serializedState
    )
    .run();
}


/**
 * دریافت State کاربر
 */
export async function getUserState(
  db,
  userId
) {
  if (!db) {
    return null;
  }

  if (
    userId === undefined ||
    userId === null
  ) {
    return null;
  }

  const row = await db
    .prepare(`
      SELECT
        id,
        user_id,
        state,
        created_at,
        updated_at
      FROM user_states
      WHERE user_id = ?
      LIMIT 1
    `)
    .bind(userId)
    .first();

  if (!row) {
    return null;
  }

  const parsed =
    deserializeState(row.state);

  return {
    ...row,
    state: parsed?.state ?? null,
    data: parsed?.data ?? {},
  };
}


/**
 * حذف State کاربر
 */
export async function clearUserState(
  db,
  userId
) {
  if (!db) {
    return;
  }

  if (
    userId === undefined ||
    userId === null
  ) {
    return;
  }

  await db
    .prepare(`
      DELETE FROM user_states
      WHERE user_id = ?
    `)
    .bind(userId)
    .run();
}
