BEGIN;
CREATE TABLE order_payment_terms (
 store_id uuid NOT NULL, order_id uuid NOT NULL,
 agreed_total_uzs bigint NOT NULL CHECK(agreed_total_uzs>0),
 payment_type text NOT NULL CHECK(payment_type IN ('cash','installment')),
 initial_due_uzs bigint NOT NULL DEFAULT 0 CHECK(initial_due_uzs>=0 AND initial_due_uzs<=agreed_total_uzs),
 CHECK((payment_type='cash' AND initial_due_uzs=0) OR (payment_type='installment' AND initial_due_uzs>0)),
 PRIMARY KEY(store_id,order_id),
 FOREIGN KEY(store_id,order_id) REFERENCES orders(store_id,id)
);
CREATE TABLE order_manual_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL, order_id uuid NOT NULL,
 amount_uzs bigint NOT NULL CHECK(amount_uzs>0),
 kind text NOT NULL CHECK(kind IN ('cash','initial')),
 method text NOT NULL CHECK(method IN ('cash','transfer','other')),
 received_on date NOT NULL,
 idempotency_key uuid NOT NULL,
 recorded_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(store_id,id), UNIQUE(store_id,idempotency_key),
 FOREIGN KEY(store_id,order_id) REFERENCES order_payment_terms(store_id,order_id),
 FOREIGN KEY(store_id,recorded_by) REFERENCES memberships(store_id,account_id)
);
CREATE TABLE order_receipt_reversals (
 store_id uuid NOT NULL, receipt_id uuid NOT NULL,
 reversed_by uuid NOT NULL, reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 240),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(store_id,receipt_id),
 FOREIGN KEY(store_id,receipt_id) REFERENCES order_manual_receipts(store_id,id),
 FOREIGN KEY(store_id,reversed_by) REFERENCES memberships(store_id,account_id)
);
CREATE INDEX order_receipts_order_idx ON order_manual_receipts(store_id,order_id,created_at);
COMMIT;
