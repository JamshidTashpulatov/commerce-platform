BEGIN;
CREATE TABLE investor_access_settings (
 store_id uuid PRIMARY KEY REFERENCES stores(id),
 allow_peer_portfolios boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
