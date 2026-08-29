-- CURRENT D1 COMPATIBILITY MIGRATION
-- Run the single statement below in the Cloudflare D1 Console.
-- This is the only subscription column still missing from the current DB schema.

ALTER TABLE course_purchases ADD COLUMN invite_link_expires_at TEXT;
