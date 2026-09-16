CREATE TABLE IF NOT EXISTS attendance_reminder_settings (
  client_id INTEGER PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  message_text TEXT NOT NULL DEFAULT 'ตอนนี้ 12:30 น. หากเข้าทำงานแล้ว กรุณาเช็กอิน',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
