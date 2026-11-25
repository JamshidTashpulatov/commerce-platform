BEGIN;
-- One customer payment may cover several months of the schedule. It is stored as one receipt per
-- month, all carrying the payment's own key here, so they are found, repeated and reversed together.
-- NULL: an ordinary payment that stayed inside one month.
ALTER TABLE installment_receipts ADD COLUMN payment_key uuid;
CREATE INDEX installment_receipts_payment_key_idx ON installment_receipts(store_id,payment_key) WHERE payment_key IS NOT NULL;
COMMIT;
