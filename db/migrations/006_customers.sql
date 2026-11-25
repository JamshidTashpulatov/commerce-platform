BEGIN;
CREATE TABLE customers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL REFERENCES stores(id),
 name_cipher text NOT NULL,
 phone_cipher text NOT NULL,
 phone_lookup text NOT NULL CHECK(phone_lookup ~ '^[0-9a-f]{64}$'),
 passport_cipher text,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(store_id,id), UNIQUE(store_id,phone_lookup),
 FOREIGN KEY(store_id,created_by) REFERENCES memberships(store_id,account_id)
);
ALTER TABLE orders ADD COLUMN customer_record_id uuid;
ALTER TABLE orders ADD CONSTRAINT order_customer_record FOREIGN KEY(store_id,customer_record_id) REFERENCES customers(store_id,id);
CREATE INDEX orders_customer_record_idx ON orders(store_id,customer_record_id);
COMMIT;
