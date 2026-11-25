BEGIN;
CREATE TABLE telegram_auth_assertions (
  assertion_hash text PRIMARY KEY CHECK (assertion_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL
);
CREATE INDEX telegram_auth_expiry_idx ON telegram_auth_assertions(expires_at);
COMMIT;
