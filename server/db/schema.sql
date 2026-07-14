-- DOFFA Crazy 8 — Postgres schema (economy + auth stubs).
-- Safe to re-run. npm run migrate

-- Auth stubs (Variant A)
CREATE TABLE IF NOT EXISTS game_users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL DEFAULT '',
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
  user_id       TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

-- Economy: authoritative cups/зёрна + rewards/claims
CREATE TABLE IF NOT EXISTS doffa_users (
  id              TEXT PRIMARY KEY,
  telegram_id     TEXT,
  wallet_address  TEXT,
  cups_balance    INTEGER NOT NULL DEFAULT 0 CHECK (cups_balance >= 0),
  pending_doffa   INTEGER NOT NULL DEFAULT 0 CHECK (pending_doffa >= 0),
  claimed_doffa   INTEGER NOT NULL DEFAULT 0 CHECK (claimed_doffa >= 0),
  energy          INTEGER NOT NULL DEFAULT 1000 CHECK (energy >= 0),
  last_energy_ts  BIGINT NOT NULL DEFAULT 0,
  total_taps      BIGINT NOT NULL DEFAULT 0,
  banned          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      BIGINT NOT NULL,
  updated_at      BIGINT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS doffa_users_wallet_uq
  ON doffa_users (wallet_address)
  WHERE wallet_address IS NOT NULL;

CREATE TABLE IF NOT EXISTS doffa_matches (
  match_id        TEXT PRIMARY KEY,
  players         TEXT[] NOT NULL,
  winner_wallet   TEXT NOT NULL DEFAULT '',
  started_at      BIGINT NOT NULL,
  finished_at     BIGINT NOT NULL,
  cups_entry_fee  INTEGER NOT NULL DEFAULT 0,
  doffa_reward    INTEGER NOT NULL DEFAULT 0,
  reward_status   TEXT NOT NULL DEFAULT 'none',
  flags           TEXT[]
);

CREATE TABLE IF NOT EXISTS doffa_rewards (
  id              TEXT PRIMARY KEY,
  match_id        TEXT NOT NULL REFERENCES doffa_matches(match_id),
  user_id         TEXT NOT NULL REFERENCES doffa_users(id),
  wallet_address  TEXT NOT NULL,
  amount          INTEGER NOT NULL CHECK (amount > 0),
  status          TEXT NOT NULL,
  created_at      BIGINT NOT NULL,
  updated_at      BIGINT NOT NULL
);

-- One reward document per match (idempotent gameOver award)
CREATE UNIQUE INDEX IF NOT EXISTS doffa_rewards_match_uq ON doffa_rewards (match_id);
CREATE INDEX IF NOT EXISTS doffa_rewards_user_status_idx ON doffa_rewards (user_id, status);

CREATE TABLE IF NOT EXISTS doffa_claims (
  id                TEXT PRIMARY KEY,
  reward_id         TEXT NOT NULL REFERENCES doffa_rewards(id),
  user_id           TEXT NOT NULL REFERENCES doffa_users(id),
  wallet_address    TEXT NOT NULL,
  amount            INTEGER NOT NULL CHECK (amount > 0),
  idempotency_key   TEXT NOT NULL,
  status            TEXT NOT NULL,
  tx_signature      TEXT,
  reason            TEXT,
  created_at        BIGINT NOT NULL,
  updated_at        BIGINT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS doffa_claims_idem_uq ON doffa_claims (idempotency_key);
-- One active claim per reward (failed can be replaced by new row)
CREATE UNIQUE INDEX IF NOT EXISTS doffa_claims_reward_active_uq
  ON doffa_claims (reward_id)
  WHERE status <> 'failed';
CREATE INDEX IF NOT EXISTS doffa_claims_user_idx ON doffa_claims (user_id);
