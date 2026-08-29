-- محدود کردن هم‌زمانی فاکتورهای pending
-- برای هر کاربر و هر پلن فقط یک فاکتور پرداخت‌نشده
-- می‌تواند وجود داشته باشد.
--
-- این migration را فقط یک‌بار روی REMOTE D1 اجرا کنید.

CREATE UNIQUE INDEX IF NOT EXISTS idx_course_purchases_one_pending_per_plan
ON course_purchases(user_id, course_plan)
WHERE status = 'waiting_payment'
  AND course_plan IS NOT NULL;
