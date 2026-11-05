ALTER TABLE traders ADD COLUMN last_seen_at INTEGER NOT NULL DEFAULT 0;
UPDATE traders SET last_seen_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000;
