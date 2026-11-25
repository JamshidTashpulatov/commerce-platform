BEGIN;
ALTER TABLE order_manual_receipts ADD CONSTRAINT receipt_order_identity UNIQUE(store_id,order_id,id);
CREATE TABLE investor_initial_returns (
 store_id uuid NOT NULL,order_id uuid NOT NULL,receipt_id uuid NOT NULL,investor_account_id uuid NOT NULL,
 amount_uzs bigint NOT NULL CHECK(amount_uzs>0),
 recorded_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(store_id,receipt_id,investor_account_id),
 FOREIGN KEY(store_id,order_id,receipt_id) REFERENCES order_manual_receipts(store_id,order_id,id),
 FOREIGN KEY(store_id,order_id,investor_account_id) REFERENCES order_funding_allocations(store_id,order_id,investor_account_id),
 FOREIGN KEY(store_id,recorded_by) REFERENCES memberships(store_id,account_id)
);
CREATE INDEX investor_initial_returns_account_idx ON investor_initial_returns(store_id,investor_account_id);
CREATE VIEW investor_funding_balances AS
 SELECT a.store_id,a.order_id,a.investor_account_id,a.amount_uzs,
 COALESCE(r.returned,0)::bigint AS returned_uzs,
 (a.amount_uzs-COALESCE(r.returned,0))::bigint AS outstanding_uzs
 FROM order_funding_allocations a LEFT JOIN LATERAL (
 SELECT SUM(i.amount_uzs) AS returned FROM investor_initial_returns i
 LEFT JOIN order_receipt_reversals v ON v.store_id=i.store_id AND v.receipt_id=i.receipt_id
 WHERE i.store_id=a.store_id AND i.order_id=a.order_id AND i.investor_account_id=a.investor_account_id AND v.receipt_id IS NULL
 ) r ON true;
COMMIT;
