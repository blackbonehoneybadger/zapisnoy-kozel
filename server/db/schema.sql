-- Postgres skeleton for DOFFA Crazy 8 (Variant A).
-- No JSON migration yet — schema only. Safe to re-run.

CREATE TABLE IF NOT EXISTS game_users (
  id            TEXT PRIMARY KEY,              -- Solana wallet address
  name          TEXT NOT NULL,
  cups          INTEGER NOT NULL DEFAULT 0 CHECK (cups >= 0),
  doffa         INTEGER NOT NULL DEFAULT 0 CHECK (doffa >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_nonces (
  address       TEXT PRIMARY KEY,
  nonce         TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash    TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES game_users(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

-- Future economy tables (empty until claim/match server wiring).

CREATE TABLE IF NOT EXISTS match_results (
  id            TEXT PRIMARY KEY,
  table_id      TEXT NOT NULL,
  winner_id     TEXT REFERENCES game_users(id),
  pot_lamports  BIGINT NOT NULL DEFAULT 0,
  network       TEXT NOT NULL DEFAULT 'mainnet-beta',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claim_requests (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES game_users(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL CHECK (amount > 0),
  status        TEXT NOT NULL DEFAULT 'pending',
  tx_signature  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS claim_requests_user_id_idx ON claim_requests (user_id);
