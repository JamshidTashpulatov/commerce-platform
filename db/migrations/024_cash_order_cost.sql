BEGIN;
-- Cash sales are attributed to investors too (confirmed 2026-11-25), so a cash order may now
-- record what the product cost. Only the cost is stored for cash; the instalment quote columns
-- stay empty. Nothing here posts cash receipts to investor ledgers.
ALTER TABLE order_payment_terms DROP CONSTRAINT installment_quote_consistency;
ALTER TABLE order_payment_terms ADD CONSTRAINT installment_quote_consistency CHECK(
 (cost_uzs IS NULL AND financed_principal_uzs IS NULL AND markup_uzs IS NULL AND term_months IS NULL AND minimum_initial_bps IS NULL AND monthly_markup_bps IS NULL)
 OR
 (payment_type='cash' AND cost_uzs IS NOT NULL AND cost_uzs>0 AND financed_principal_uzs IS NULL AND markup_uzs IS NULL AND term_months IS NULL AND minimum_initial_bps IS NULL AND monthly_markup_bps IS NULL)
 OR
 (payment_type='installment' AND cost_uzs IS NOT NULL AND financed_principal_uzs IS NOT NULL AND markup_uzs IS NOT NULL AND term_months IS NOT NULL AND minimum_initial_bps IS NOT NULL AND monthly_markup_bps IS NOT NULL
 AND cost_uzs>0 AND financed_principal_uzs>0 AND markup_uzs>=0 AND term_months BETWEEN 1 AND 60 AND minimum_initial_bps BETWEEN 1 AND 9999 AND monthly_markup_bps BETWEEN 0 AND 10000
 AND initial_due_uzs::numeric*10000 >= cost_uzs::numeric*minimum_initial_bps
 AND financed_principal_uzs=cost_uzs-initial_due_uzs
 AND markup_uzs=round(financed_principal_uzs::numeric*monthly_markup_bps*term_months/10000)
 AND agreed_total_uzs=cost_uzs+markup_uzs)
);
COMMIT;
