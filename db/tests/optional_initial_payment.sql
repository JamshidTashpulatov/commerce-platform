BEGIN;
-- The initial payment of an instalment sale may be 0 or below the suggested minimum, never the whole cost.
DO $$
DECLARE store_a uuid; o1 uuid; o2 uuid; o3 uuid; refused int:=0;
BEGIN
  INSERT INTO stores(name) VALUES ('Optional initial') RETURNING id INTO store_a;
  INSERT INTO orders(store_id) VALUES(store_a) RETURNING id INTO o1;
  INSERT INTO orders(store_id) VALUES(store_a) RETURNING id INTO o2;
  INSERT INTO orders(store_id) VALUES(store_a) RETURNING id INTO o3;
  -- Zero initial: the whole cost is financed. 1000 at 4% for 3 months is 120 markup.
  INSERT INTO order_payment_terms(store_id,order_id,agreed_total_uzs,payment_type,initial_due_uzs,cost_uzs,financed_principal_uzs,markup_uzs,term_months,minimum_initial_bps,monthly_markup_bps)
    VALUES(store_a,o1,1120,'installment',0,1000,1000,120,3,2500,400);
  -- Below the suggested 25%.
  INSERT INTO order_payment_terms(store_id,order_id,agreed_total_uzs,payment_type,initial_due_uzs,cost_uzs,financed_principal_uzs,markup_uzs,term_months,minimum_initial_bps,monthly_markup_bps)
    VALUES(store_a,o2,1108,'installment',100,1000,900,108,3,2500,400);
  -- The whole cost as initial leaves nothing to finance: still refused.
  BEGIN
    INSERT INTO order_payment_terms(store_id,order_id,agreed_total_uzs,payment_type,initial_due_uzs,cost_uzs,financed_principal_uzs,markup_uzs,term_months,minimum_initial_bps,monthly_markup_bps)
      VALUES(store_a,o3,1000,'installment',1000,1000,0,0,3,2500,400);
  EXCEPTION WHEN check_violation THEN refused:=refused+1; END;
  -- A cash order still cannot carry an initial payment.
  BEGIN
    INSERT INTO order_payment_terms(store_id,order_id,agreed_total_uzs,payment_type,initial_due_uzs) VALUES(store_a,o3,1000,'cash',100);
  EXCEPTION WHEN check_violation THEN refused:=refused+1; END;
  IF refused<>2 THEN RAISE EXCEPTION 'expected two refusals, got %',refused; END IF;
END $$;
ROLLBACK;
