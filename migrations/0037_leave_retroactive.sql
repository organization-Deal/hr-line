-- Nakna P9.29 — retroactive leave requests
ALTER TABLE leave_requests ADD COLUMN is_retroactive INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leave_requests ADD COLUMN retro_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_leave_retroactive_status ON leave_requests(client_id,is_retroactive,status,created_at);
