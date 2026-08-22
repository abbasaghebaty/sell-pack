-- Blupal payment fields for the existing course_purchases table.
-- Run once against the REMOTE D1 database.

ALTER TABLE course_purchases ADD COLUMN blupal_invoice_id INTEGER;
ALTER TABLE course_purchases ADD COLUMN blupal_final_amount INTEGER;
ALTER TABLE course_purchases ADD COLUMN blupal_payment_link TEXT;
ALTER TABLE course_purchases ADD COLUMN payment_mode TEXT;
ALTER TABLE course_purchases ADD COLUMN transaction_id INTEGER;
ALTER TABLE course_purchases ADD COLUMN paid_at TEXT;
ALTER TABLE course_purchases ADD COLUMN updated_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_course_purchases_blupal_invoice
ON course_purchases(blupal_invoice_id)
WHERE blupal_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_course_purchases_waiting_payment
ON course_purchases(user_id, status);
