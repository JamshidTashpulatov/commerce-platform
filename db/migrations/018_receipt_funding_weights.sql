BEGIN;
CREATE TABLE installment_receipt_funding_weights (
  store_id uuid NOT NULL,
  receipt_id uuid NOT NULL,
  investor_account_id uuid NOT NULL,
  invested_uzs bigint NOT NULL CHECK (invested_uzs > 0),
  PRIMARY KEY (store_id,receipt_id,investor_account_id),
  FOREIGN KEY (store_id,receipt_id) REFERENCES installment_receipts(store_id,id),
  FOREIGN KEY (store_id,investor_account_id) REFERENCES memberships(store_id,account_id)
);
COMMIT;
