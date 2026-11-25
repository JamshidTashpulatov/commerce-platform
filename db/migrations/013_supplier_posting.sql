BEGIN;
ALTER TABLE suppliers ADD COLUMN request_key uuid;
ALTER TABLE suppliers ADD CONSTRAINT supplier_request_unique UNIQUE(store_id,request_key);
ALTER TABLE supplier_invoices ADD COLUMN request_key uuid;
ALTER TABLE supplier_invoices ADD COLUMN reference text CHECK(length(reference)<=120);
ALTER TABLE supplier_invoices ADD CONSTRAINT invoice_request_unique UNIQUE(store_id,request_key);
ALTER TABLE supplier_payments ADD COLUMN method text CHECK(method IN ('cash','transfer','other'));
ALTER TABLE supplier_payments ADD COLUMN paid_on date;
ALTER TABLE supplier_payments ADD COLUMN recorded_by uuid;
ALTER TABLE supplier_payments ADD CONSTRAINT supplier_payment_store_id_unique UNIQUE(store_id,id);
ALTER TABLE supplier_payments ADD CONSTRAINT supplier_payment_actor FOREIGN KEY(store_id,recorded_by) REFERENCES memberships(store_id,account_id);
CREATE TABLE supplier_payment_reversals (
 store_id uuid NOT NULL,payment_id uuid NOT NULL,reversed_by uuid NOT NULL,
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 240),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(store_id,payment_id),
 FOREIGN KEY(store_id,payment_id) REFERENCES supplier_payments(store_id,id),
 FOREIGN KEY(store_id,reversed_by) REFERENCES memberships(store_id,account_id)
);
CREATE VIEW supplier_invoice_balances AS
 SELECT i.store_id,i.id,i.supplier_id,i.amount_uzs,i.due_date,i.reference,i.created_at,
 COALESCE(p.paid,0)::bigint AS paid_uzs,
 (i.amount_uzs-COALESCE(p.paid,0))::bigint AS outstanding_uzs
 FROM supplier_invoices i LEFT JOIN LATERAL (
 SELECT SUM(p.amount_uzs) AS paid FROM supplier_payments p LEFT JOIN supplier_payment_reversals v ON v.store_id=p.store_id AND v.payment_id=p.id
 WHERE p.store_id=i.store_id AND p.invoice_id=i.id AND v.payment_id IS NULL
 ) p ON true;
ALTER VIEW recorded_fund_movements RENAME TO recorded_fund_movements_v12;
CREATE VIEW recorded_fund_movements AS
 SELECT * FROM recorded_fund_movements_v12 WHERE kind<>'supplier_payment'
 UNION ALL
 SELECT store_id,id,'supplier_payment',-amount_uzs,COALESCE(paid_on,(paid_at AT TIME ZONE 'Asia/Tashkent')::date),paid_at FROM supplier_payments
 UNION ALL
 SELECT p.store_id,p.id,'supplier_payment_reversal',p.amount_uzs,(v.created_at AT TIME ZONE 'Asia/Tashkent')::date,v.created_at FROM supplier_payments p JOIN supplier_payment_reversals v ON v.store_id=p.store_id AND v.payment_id=p.id;
COMMIT;
