BEGIN;
-- Investor accounts created by phone number. The Telegram user is bound later, once, when
-- Telegram itself delivers that user's own contact to the bot (see docs/INVESTOR-ACCESS.md).
CREATE TABLE account_sign_in_phones (
 store_id uuid NOT NULL REFERENCES stores(id),
 account_id uuid NOT NULL REFERENCES accounts(id),
 phone_cipher text NOT NULL,
 phone_lookup text NOT NULL CHECK(phone_lookup ~ '^[0-9a-f]{64}$'),
 bound_at timestamptz,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(store_id,account_id),
 UNIQUE(store_id,phone_lookup),
 FOREIGN KEY(store_id,account_id) REFERENCES memberships(store_id,account_id),
 FOREIGN KEY(store_id,created_by) REFERENCES memberships(store_id,account_id)
);
-- Telegram may deliver one update more than once; each update id is handled a single time.
CREATE TABLE telegram_webhook_updates (
 update_id bigint PRIMARY KEY,
 received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX telegram_webhook_updates_received_idx ON telegram_webhook_updates(received_at);
COMMIT;
