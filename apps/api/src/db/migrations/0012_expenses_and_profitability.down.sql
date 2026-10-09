-- Migration 0012 Down: Rollback expenses extension, drop monthly_evaluations and expense_categories

DROP TABLE IF EXISTS monthly_evaluations CASCADE;

ALTER TABLE expenses DROP COLUMN IF EXISTS last_edit_reason;
ALTER TABLE expenses DROP COLUMN IF EXISTS edited;
ALTER TABLE expenses DROP COLUMN IF EXISTS payment_source;
ALTER TABLE expenses DROP COLUMN IF EXISTS reference;
ALTER TABLE expenses DROP COLUMN IF EXISTS description;
ALTER TABLE expenses DROP COLUMN IF EXISTS month;
ALTER TABLE expenses DROP COLUMN IF EXISTS expense_date;
ALTER TABLE expenses DROP COLUMN IF EXISTS category_id;

DROP TABLE IF EXISTS expense_categories CASCADE;
