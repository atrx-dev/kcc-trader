CREATE TABLE traders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT NOT NULL,
  kcc_name TEXT,
  kcc_id TEXT,
  accepting INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE list_entries (
  trader_id TEXT NOT NULL REFERENCES traders (id) ON DELETE CASCADE,
  list TEXT NOT NULL CHECK (list IN ('forTrade', 'wishlist')),
  card_key TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (trader_id, list, card_key)
);

CREATE INDEX list_entries_by_card ON list_entries (list, card_key);
