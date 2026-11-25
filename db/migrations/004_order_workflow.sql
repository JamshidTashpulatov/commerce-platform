BEGIN;
ALTER TABLE variants ADD COLUMN storage_label text;
ALTER TABLE orders ADD COLUMN source text NOT NULL DEFAULT 'staff' CHECK(source IN ('staff','website'));
ALTER TABLE orders ADD COLUMN request_status text NOT NULL DEFAULT 'new' CHECK(request_status IN ('new','in_progress','cancelled'));
ALTER TABLE orders ADD COLUMN sale_status text NOT NULL DEFAULT 'not_sold' CHECK(sale_status IN ('not_sold','sold'));
ALTER TABLE orders ADD COLUMN fulfillment_status text NOT NULL DEFAULT 'not_delivered' CHECK(fulfillment_status IN ('not_delivered','in_transit','delivered'));
ALTER TABLE orders ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK(revision>=0);
ALTER TABLE orders ADD COLUMN request_key uuid;
ALTER TABLE orders ADD COLUMN created_by uuid REFERENCES accounts(id);
ALTER TABLE orders ADD CONSTRAINT order_request_unique UNIQUE(store_id,request_key);
ALTER TABLE orders ADD CONSTRAINT order_actor_membership FOREIGN KEY(store_id,created_by) REFERENCES memberships(store_id,account_id);
CREATE INDEX orders_inbox_idx ON orders(store_id,request_status,created_at DESC);
CREATE TABLE order_funding_allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL,
 order_id uuid NOT NULL,
 investor_account_id uuid NOT NULL,
 amount_uzs bigint NOT NULL CHECK(amount_uzs>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(store_id,order_id,investor_account_id),
 FOREIGN KEY(store_id,order_id) REFERENCES orders(store_id,id),
 FOREIGN KEY(store_id,investor_account_id) REFERENCES memberships(store_id,account_id)
);
COMMIT;
