BEGIN;
-- The suppliers section is no longer part of the app (owner decision, 2026-11-26). Its tables
-- (suppliers, supplier_invoices, supplier_payments, purchase_stock_receipts and their views) stay
-- in place, unused. Stock is now set by a plain adjustment: a new quantity and the reason for it.
CREATE TABLE stock_adjustments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL,variant_id uuid NOT NULL,
 quantity_before integer NOT NULL CHECK(quantity_before>=0),
 quantity_after integer NOT NULL CHECK(quantity_after>=0),
 CHECK(quantity_before<>quantity_after),
 note text NOT NULL CHECK(length(trim(note)) BETWEEN 3 AND 240),
 request_key uuid NOT NULL,
 recorded_by uuid NOT NULL,
 stock_movement_id uuid NOT NULL UNIQUE REFERENCES stock_movements(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(store_id,request_key),
 FOREIGN KEY(store_id,variant_id) REFERENCES variants(store_id,id),
 FOREIGN KEY(store_id,recorded_by) REFERENCES memberships(store_id,account_id)
);
CREATE INDEX stock_adjustments_variant_idx ON stock_adjustments(store_id,variant_id,created_at DESC);
COMMIT;
