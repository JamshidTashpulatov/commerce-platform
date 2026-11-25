BEGIN;
CREATE TABLE investor_profiles (
 store_id uuid NOT NULL, account_id uuid NOT NULL,
 display_name text NOT NULL CHECK(length(trim(display_name)) BETWEEN 1 AND 120),
 PRIMARY KEY(store_id,account_id),
 FOREIGN KEY(store_id,account_id) REFERENCES memberships(store_id,account_id)
);
CREATE INDEX funding_investor_idx ON order_funding_allocations(store_id,investor_account_id);
COMMIT;
