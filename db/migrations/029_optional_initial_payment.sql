BEGIN;
-- The initial payment of an instalment sale is optional: anything from 0 up to less than the cost.
-- The configured minimum stays recorded with the terms (minimum_initial_bps) as the suggestion that
-- was shown, but it is no longer a limit.
DO $$
DECLARE name text;
BEGIN
 -- The 005 check that required a positive initial payment for instalments was created without a name.
 FOR name IN SELECT conname FROM pg_constraint
   WHERE conrelid='order_payment_terms'::regclass AND contype='c'
     AND pg_get_constraintdef(oid) LIKE '%payment_type = ''installment''%' AND pg_get_constraintdef(oid) LIKE '%initial_due_uzs > 0%'
     AND conname<>'installment_quote_consistency'
 LOOP EXECUTE format('ALTER TABLE order_payment_terms DROP CONSTRAINT %I',name); END LOOP;
END $$;
-- Cash orders still have no initial payment.
ALTER TABLE order_payment_terms ADD CONSTRAINT cash_has_no_initial_payment CHECK(payment_type='installment' OR initial_due_uzs=0);
ALTER TABLE order_payment_terms DROP CONSTRAINT installment_quote_consistency;
ALTER TABLE order_payment_terms ADD CONSTRAINT installment_quote_consistency CHECK(
 (cost_uzs IS NULL AND financed_principal_uzs IS NULL AND markup_uzs IS NULL AND term_months IS NULL AND minimum_initial_bps IS NULL AND monthly_markup_bps IS NULL)
 OR
 (payment_type='cash' AND cost_uzs IS NOT NULL AND cost_uzs>0 AND financed_principal_uzs IS NULL AND markup_uzs IS NULL AND term_months IS NULL AND minimum_initial_bps IS NULL AND monthly_markup_bps IS NULL)
 OR
 (payment_type='installment' AND cost_uzs IS NOT NULL AND financed_principal_uzs IS NOT NULL AND markup_uzs IS NOT NULL AND term_months IS NOT NULL AND minimum_initial_bps IS NOT NULL AND monthly_markup_bps IS NOT NULL
 AND cost_uzs>0 AND financed_principal_uzs>0 AND markup_uzs>=0 AND term_months BETWEEN 1 AND 60 AND minimum_initial_bps BETWEEN 1 AND 9999 AND monthly_markup_bps BETWEEN 0 AND 10000
 AND financed_principal_uzs=cost_uzs-initial_due_uzs
 AND markup_uzs=round(financed_principal_uzs::numeric*monthly_markup_bps*term_months/10000)
 AND agreed_total_uzs=cost_uzs+markup_uzs)
);
COMMIT;
