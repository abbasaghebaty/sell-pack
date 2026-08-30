export async function savePurchaseInviteLink(
  db,
  purchaseId,
  inviteLink,
  expiresAt,
) {
  await db
    .prepare(`
      UPDATE course_purchases
      SET
        invite_link = ?,
        invite_link_created_at = CURRENT_TIMESTAMP,
        invite_link_expires_at = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .bind(
      inviteLink ?? null,
      expiresAt ?? null,
      purchaseId,
    )
    .run();
}

export async function markPurchaseJoined(
  db,
  purchaseId,
) {
  await db
    .prepare(`
      UPDATE course_purchases
      SET
        channel_joined_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .bind(purchaseId)
    .run();
}

export async function clearPurchaseInviteLink(
  db,
  purchaseId,
) {
  await db
    .prepare(`
      UPDATE course_purchases
      SET
        invite_link = NULL,
        invite_link_used_at = CURRENT_TIMESTAMP,
        invite_link_expires_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .bind(purchaseId)
    .run();
}
