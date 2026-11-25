BEGIN;
CREATE TABLE purchase_stock_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL,
 invoice_id uuid NOT NULL,
 variant_id uuid NOT NULL,
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 10000),
 unit_cost_uzs bigint NOT NULL CHECK(unit_cost_uzs>0),
 received_on date NOT NULL,
 request_key uuid NOT NULL,
 recorded_by uuid NOT NULL,
 stock_movement_id uuid NOT NULL UNIQUE REFERENCES stock_movements(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(store_id,request_key),
 FOREIGN KEY(store_id,invoice_id) REFERENCES supplier_invoices(store_id,id),
 FOREIGN KEY(store_id,variant_id) REFERENCES variants(store_id,id),
 FOREIGN KEY(store_id,recorded_by) REFERENCES memberships(store_id,account_id)
);
CREATE INDEX purchase_receipts_invoice_idx ON purchase_stock_receipts(store_id,invoice_id);
CREATE INDEX purchase_receipts_variant_idx ON purchase_stock_receipts(store_id,variant_id);
COMMIT;
