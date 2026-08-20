/**
 * User State
 *
 * مسیر:
 * src/state/userState.js
 *
 * برای نگهداری وضعیت موقت کاربر استفاده می‌شود.
 */

const states = new Map();

/**
 * وضعیت کاربر را ذخیره می‌کند.
 */
export function setUserState(
  telegramId,
  state
) {
  states.set(
    String(telegramId),
    state
  );
}

/**
 * وضعیت کاربر را می‌گیرد.
 */
export function getUserState(
  telegramId
) {
  return states.get(
    String(telegramId)
  ) || null;
}

/**
 * وضعیت کاربر را حذف می‌کند.
 */
export function clearUserState(
  telegramId
) {
  states.delete(
    String(telegramId)
  );
}
