-- Nakna HR P9.03 — Company-specific payroll cycle
-- Each company can define its own default payroll date range.
-- Example: payroll month 2026-02 can cover 2026-01-25 through 2026-02-25.

ALTER TABLE payroll_settings ADD COLUMN cycle_start_day INTEGER NOT NULL DEFAULT 1;
ALTER TABLE payroll_settings ADD COLUMN cycle_start_month_offset INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payroll_settings ADD COLUMN cycle_end_day INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payroll_settings ADD COLUMN cycle_end_month_offset INTEGER NOT NULL DEFAULT 0;
