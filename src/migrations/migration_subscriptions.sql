-- Subscription/access fields for course_purchases.
-- Run once against the REMOTE D1 database.

ALTER TABLE course_purchases ADD COLUMN plan_code TEXT;
ALTER TABLE course_purchases ADD COLUMN duration_days INTEGER;
ALTER TABLE course_purchases ADD COLUMN expires_at TEXT;
ALTER TABLE course_purchases ADD COLUMN activated_at TEXT;
ALTER TABLE course_purchases ADD COLUMN access_status TEXT DEFAULT 'pending';
ALTER TABLE course_purchases ADD COLUMN channel_id TEXT;
ALTER TABLE course_purchases ADD COLUMN invite_link TEXT;
ALTER TABLE course_purchases ADD COLUMN invite_link_expires_at TEXT;
ALTER TABLE course_purchases ADD COLUMN channel_joined_at TEXT;

CREATE INDEX IF NOT EXISTS idx_course_purchases_active_access
ON course_purchases(user_id, status, access_status, expires_at);

CREATE INDEX IF NOT EXISTS idx_course_purchases_invite_link
ON course_purchases(invite_link);

-- Purchases that were already approved before the subscription system are
-- treated as legacy permanent access so existing customers are not removed.
UPDATE course_purchases
SET
  plan_code = COALESCE(plan_code, 'legacy'),
  access_status = 'active',
  activated_at = COALESCE(activated_at, paid_at, CURRENT_TIMESTAMP)
WHERE status = 'approved';
