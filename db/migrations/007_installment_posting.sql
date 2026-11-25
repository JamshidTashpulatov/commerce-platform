BEGIN;
ALTER TABLE installment_receipts ADD COLUMN received_on date;
ALTER TABLE installment_receipts ADD COLUMN method text CHECK(method IN ('cash','transfer','other'));
CREATE TABLE installment_receipt_reversals (
 store_id uuid NOT NULL, receipt_id uuid NOT NULL, reversed_by uuid NOT NULL,
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 240),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(store_id,receipt_id),
 FOREIGN KEY(store_id,receipt_id) REFERENCES installment_receipts(store_id,id),
 FOREIGN KEY(store_id,reversed_by) REFERENCES memberships(store_id,account_id)
);
COMMIT;
