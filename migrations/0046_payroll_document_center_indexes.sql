CREATE INDEX IF NOT EXISTS idx_handoff_payment_month ON payroll_payment_confirmations(client_id,status,payment_date,period_id);
CREATE INDEX IF NOT EXISTS idx_handoff_wage_month ON payroll_periods(client_id,period_key,status);
CREATE INDEX IF NOT EXISTS idx_handoff_payroll_items ON payroll_items(client_id,period_id,employee_id);
CREATE INDEX IF NOT EXISTS idx_handoff_adjustments ON payroll_adjustments(client_id,period_id,employee_id);
