BEGIN;
CREATE TABLE installment_contracts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL,
 order_id uuid NOT NULL,
 currency text NOT NULL DEFAULT 'UZS' CHECK(currency='UZS'),
 contract_total_uzs bigint NOT NULL CHECK(contract_total_uzs>0),
 initial_payment_uzs bigint NOT NULL CHECK(initial_payment_uzs>=0 AND initial_payment_uzs<=contract_total_uzs),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','settled','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(store_id,id), UNIQUE(store_id,order_id),
 FOREIGN KEY(store_id,order_id) REFERENCES orders(store_id,id)
);
CREATE TABLE installment_schedule (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL,
 contract_id uuid NOT NULL,
 sequence_no integer NOT NULL CHECK(sequence_no>0),
 due_date date NOT NULL,
 amount_uzs bigint NOT NULL CHECK(amount_uzs>0),
 UNIQUE(store_id,id), UNIQUE(store_id,contract_id,sequence_no),
 FOREIGN KEY(store_id,contract_id) REFERENCES installment_contracts(store_id,id)
);
CREATE TABLE installment_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL,
 schedule_id uuid NOT NULL,
 amount_uzs bigint NOT NULL CHECK(amount_uzs>0),
 idempotency_key uuid NOT NULL,
 recorded_by uuid NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(store_id,id), UNIQUE(store_id,idempotency_key),
 FOREIGN KEY(store_id,schedule_id) REFERENCES installment_schedule(store_id,id),
 FOREIGN KEY(store_id,recorded_by) REFERENCES memberships(store_id,account_id)
);
CREATE TABLE suppliers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL REFERENCES stores(id),
 display_name text NOT NULL CHECK(length(trim(display_name))>0),
 UNIQUE(store_id,id)
);
CREATE TABLE supplier_invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL,
 supplier_id uuid NOT NULL,
 amount_uzs bigint NOT NULL CHECK(amount_uzs>0),
 due_date date,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(store_id,id),
 FOREIGN KEY(store_id,supplier_id) REFERENCES suppliers(store_id,id)
);
CREATE TABLE supplier_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL,
 invoice_id uuid NOT NULL,
 amount_uzs bigint NOT NULL CHECK(amount_uzs>0),
 idempotency_key uuid NOT NULL,
 paid_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(store_id,idempotency_key),
 FOREIGN KEY(store_id,invoice_id) REFERENCES supplier_invoices(store_id,id)
);
CREATE TABLE investor_capital_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL,
 investor_account_id uuid NOT NULL,
 event_type text NOT NULL CHECK(event_type IN ('contribution','withdrawal','distribution')),
 amount_uzs bigint NOT NULL CHECK(amount_uzs>0),
 idempotency_key uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(store_id,idempotency_key),
 FOREIGN KEY(store_id,investor_account_id) REFERENCES memberships(store_id,account_id)
);
CREATE INDEX installment_due_idx ON installment_schedule(store_id,due_date);
CREATE INDEX installment_receipts_schedule_idx ON installment_receipts(store_id,schedule_id);
CREATE INDEX supplier_payments_invoice_idx ON supplier_payments(store_id,invoice_id);
CREATE INDEX investor_events_account_idx ON investor_capital_events(store_id,investor_account_id,created_at);
COMMIT;
