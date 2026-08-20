/**
 * Users Database
 *
 * مسیر:
 * src/database/users.js
 *
 * مسئول:
 * - ایجاد کاربر
 * - بروزرسانی اطلاعات کاربر
 * - برگرداندن شناسه داخلی کاربر
 */

export async function ensureUser(db, telegramUser) {
  if (!db) {
    throw new Error('Database is not available');
  }

  if (!telegramUser?.id) {
    throw new Error('Invalid Telegram user');
  }

  const telegramId = telegramUser.id;
  const username = telegramUser.username ?? null;
  const firstName = telegramUser.first_name ?? null;
  const lastName = telegramUser.last_name ?? null;
  const languageCode = telegramUser.language_code ?? null;
  const isBot = telegramUser.is_bot ? 1 : 0;

  const existingUser = await db
    .prepare(`
      SELECT id
      FROM users
      WHERE telegram_id = ?
      LIMIT 1
    `)
    .bind(telegramId)
    .first();

  if (!existingUser) {
    const result = await db
      .prepare(`
        INSERT INTO users (
          telegram_id,
          username,
          first_name,
          last_name,
          language_code,
          is_bot
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(
        telegramId,
        username,
        firstName,
        lastName,
        languageCode,
        isBot
      )
      .run();

    return {
      id: result?.meta?.last_row_id ?? null,
      telegramId,
      isNew: true,
    };
  }

  await db
    .prepare(`
      UPDATE users
      SET
        username = ?,
        first_name = ?,
        last_name = ?,
        language_code = ?,
        is_bot = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE telegram_id = ?
    `)
    .bind(
      username,
      firstName,
      lastName,
      languageCode,
      isBot,
      telegramId
    )
    .run();

  return {
    id: existingUser.id,
    telegramId,
    isNew: false,
  };
}
