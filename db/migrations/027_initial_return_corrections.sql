BEGIN;
-- Initial capital returns are computed by the system in proportion to funding.
-- When an administrator corrects an older hand-typed split, every changed share is kept here:
-- what the investor had for that receipt before, what they have after, who corrected it and when.
CREATE TABLE investor_initial_return_corrections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL,order_id uuid NOT NULL,receipt_id uuid NOT NULL,investor_account_id uuid NOT NULL,
 old_amount_uzs bigint NOT NULL CHECK(old_amount_uzs>=0),
 new_amount_uzs bigint NOT NULL CHECK(new_amount_uzs>=0),
 CHECK(old_amount_uzs<>new_amount_uzs),
 corrected_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(store_id,order_id,receipt_id) REFERENCES order_manual_receipts(store_id,order_id,id),
 FOREIGN KEY(store_id,order_id,investor_account_id) REFERENCES order_funding_allocations(store_id,order_id,investor_account_id),
 FOREIGN KEY(store_id,corrected_by) REFERENCES memberships(store_id,account_id)
);
CREATE INDEX investor_initial_return_corrections_order_idx ON investor_initial_return_corrections(store_id,order_id);
COMMIT;
