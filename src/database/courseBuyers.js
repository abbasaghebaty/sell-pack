export async function upsertCourseBuyer(
  db,
  telegramId,
  accessType,
  purchasedAt,
  expiresAt,
) {
  await db
    .prepare(`
      INSERT INTO course_buyers (
        telegram_id,
        access_type,
        purchased_at,
        expires_at,
        is_active
      )
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(telegram_id)
      DO UPDATE SET
        access_type = excluded.access_type,
        purchased_at = excluded.purchased_at,
        expires_at = excluded.expires_at,
        is_active = 1
    `)
    .bind(
      telegramId,
      accessType,
      purchasedAt ?? new Date().toISOString(),
      expiresAt ?? null,
    )
    .run();
}

export async function getActiveCourseBuyer(
  db,
  telegramId,
) {
  return db
    .prepare(`
      SELECT *
      FROM course_buyers
      WHERE telegram_id = ?
        AND is_active = 1
        AND (
          expires_at IS NULL
          OR datetime(expires_at) > datetime('now')
        )
      LIMIT 1
    `)
    .bind(telegramId)
    .first();
}

export async function deactivateCourseBuyer(
  db,
  telegramId,
) {
  await db
    .prepare(`
      UPDATE course_buyers
      SET is_active = 0
      WHERE telegram_id = ?
    `)
    .bind(telegramId)
    .run();
}
