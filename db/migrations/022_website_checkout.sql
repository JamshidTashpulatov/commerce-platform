-- Website checkout: guest purchase requests from the public storefront.
-- Additive only. A checkout is a request, not a sale: it writes orders with
-- source 'website' and their items, and nothing in stock, payment or finance tables.
BEGIN;

-- One row per submitted checkout. Contact details are encrypted like customer
-- records (AES-256-GCM, store/record/field-bound associated data); the phone
-- lookup is a store-scoped HMAC used for rate limiting and staff search.
CREATE TABLE website_checkouts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL REFERENCES stores(id),
 reference text NOT NULL CHECK(reference ~ '^MT-[0-9A-HJ-NP-Z]{8}$'),
 request_key uuid NOT NULL,
 channel text NOT NULL CHECK(channel IN ('cart','one_click')),
 name_cipher text NOT NULL,
 phone_cipher text NOT NULL,
 phone_lookup text NOT NULL CHECK(phone_lookup ~ '^[0-9a-f]{64}$'),
 comment_cipher text,
 telegram_account_id uuid REFERENCES accounts(id),
 line_count integer NOT NULL CHECK(line_count BETWEEN 1 AND 20),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(store_id,id),
 UNIQUE(store_id,reference),
 UNIQUE(store_id,request_key)
);
CREATE INDEX website_checkouts_phone_idx ON website_checkouts(store_id,phone_lookup,created_at DESC);

-- Each cart line becomes its own order (the order model has one SKU line per
-- order and funding is attributed per order); all share one checkout.
ALTER TABLE orders ADD COLUMN website_checkout_id uuid;
ALTER TABLE orders ADD CONSTRAINT order_website_checkout FOREIGN KEY(store_id,website_checkout_id) REFERENCES website_checkouts(store_id,id);
ALTER TABLE orders ADD CONSTRAINT website_order_has_checkout CHECK(source<>'website' OR website_checkout_id IS NOT NULL) NOT VALID;
CREATE INDEX orders_website_checkout_idx ON orders(store_id,website_checkout_id) WHERE website_checkout_id IS NOT NULL;

-- Abuse protection for the unauthenticated form. Buckets hold HMACs of the
-- client address or phone, never the raw values. Rows older than a day are pruned.
CREATE TABLE website_checkout_attempts (
 store_id uuid NOT NULL REFERENCES stores(id),
 bucket text NOT NULL CHECK(bucket ~ '^(ip|phone):[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX website_checkout_attempts_idx ON website_checkout_attempts(store_id,bucket,created_at);

-- Customer sign-in (Telegram) uses its own sessions and cookie. requireStoreRole
-- only reads `sessions`, so a customer session can never act as staff, seller,
-- investor or admin, even for a Telegram account that also has such a role.
CREATE TABLE customer_sessions (
 token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 store_id uuid NOT NULL REFERENCES stores(id),
 account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 name_cipher text,
 phone_cipher text,
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_sessions_expiry_idx ON customer_sessions(expires_at);

COMMIT;
