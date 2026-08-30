CREATE TABLE IF NOT EXISTS wallet_topups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  telegram_id TEXT NOT NULL,

  amount_toman INTEGER NOT NULL,
  amount_rial INTEGER NOT NULL,

  blupal_invoice_id INTEGER UNIQUE,
  blupal_final_amount INTEGER,

  blupal_payment_link TEXT,
  blupal_expires_at TEXT,

  status TEXT NOT NULL DEFAULT 'waiting_payment',

  transaction_id TEXT,

  paid_at TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallet_topups_telegram
ON wallet_topups (telegram_id);

CREATE INDEX IF NOT EXISTS idx_wallet_topups_status
ON wallet_topups (status);

CREATE INDEX IF NOT EXISTS idx_wallet_topups_invoice
ON wallet_topups (blupal_invoice_id);
