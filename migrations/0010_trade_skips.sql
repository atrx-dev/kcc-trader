CREATE TABLE trade_skips (
  trader_id TEXT NOT NULL REFERENCES traders (id) ON DELETE CASCADE,
  card_key TEXT NOT NULL,
  PRIMARY KEY (trader_id, card_key)
);
