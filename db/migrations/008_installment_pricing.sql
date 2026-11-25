BEGIN;
ALTER TABLE order_payment_terms ADD COLUMN cost_uzs bigint;
ALTER TABLE order_payment_terms ADD COLUMN financed_principal_uzs bigint;
ALTER TABLE order_payment_terms ADD COLUMN markup_uzs bigint;
ALTER TABLE order_payment_terms ADD COLUMN term_months integer;
ALTER TABLE order_payment_terms ADD COLUMN minimum_initial_bps integer;
ALTER TABLE order_payment_terms ADD COLUMN monthly_markup_bps integer;
ALTER TABLE order_payment_terms ADD CONSTRAINT installment_quote_consistency CHECK(
 (cost_uzs IS NULL AND financed_principal_uzs IS NULL AND markup_uzs IS NULL AND term_months IS NULL AND minimum_initial_bps IS NULL AND monthly_markup_bps IS NULL)
 OR
 (payment_type='installment' AND cost_uzs IS NOT NULL AND financed_principal_uzs IS NOT NULL AND markup_uzs IS NOT NULL AND term_months IS NOT NULL AND minimum_initial_bps IS NOT NULL AND monthly_markup_bps IS NOT NULL
 AND cost_uzs>0 AND financed_principal_uzs>0 AND markup_uzs>=0 AND term_months BETWEEN 1 AND 60 AND minimum_initial_bps BETWEEN 1 AND 9999 AND monthly_markup_bps BETWEEN 0 AND 10000
 AND initial_due_uzs::numeric*10000 >= cost_uzs::numeric*minimum_initial_bps
 AND financed_principal_uzs=cost_uzs-initial_due_uzs
 AND markup_uzs=round(financed_principal_uzs::numeric*monthly_markup_bps*term_months/10000)
 AND agreed_total_uzs=cost_uzs+markup_uzs)
);
COMMIT;
