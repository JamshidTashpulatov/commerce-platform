BEGIN;
DO $$
DECLARE store_a uuid; o1 uuid; o2 uuid; o3 uuid;
BEGIN
  INSERT INTO stores(name) VALUES ('Cash cost') RETURNING id INTO store_a;
  INSERT INTO orders(store_id) VALUES(store_a) RETURNING id INTO o1;
  INSERT INTO orders(store_id) VALUES(store_a) RETURNING id INTO o2;
  INSERT INTO orders(store_id) VALUES(store_a) RETURNING id INTO o3;
  -- Cash without a cost stays valid, cash with a positive cost is now valid.
  INSERT INTO order_payment_terms(store_id,order_id,agreed_total_uzs,payment_type,initial_due_uzs) VALUES(store_a,o1,11000000,'cash',0);
  INSERT INTO order_payment_terms(store_id,order_id,agreed_total_uzs,payment_type,initial_due_uzs,cost_uzs) VALUES(store_a,o2,11000000,'cash',0,10000000);
  BEGIN
    INSERT INTO order_payment_terms(store_id,order_id,agreed_total_uzs,payment_type,initial_due_uzs,cost_uzs) VALUES(store_a,o3,11000000,'cash',0,0);
    RAISE EXCEPTION 'Zero cost accepted for a cash order';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO order_payment_terms(store_id,order_id,agreed_total_uzs,payment_type,initial_due_uzs,cost_uzs,term_months) VALUES(store_a,o3,11000000,'cash',0,10000000,3);
    RAISE EXCEPTION 'Instalment fields accepted on a cash order';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO order_payment_terms(store_id,order_id,agreed_total_uzs,payment_type,initial_due_uzs,cost_uzs) VALUES(store_a,o3,11000000,'installment',3000000,10000000);
    RAISE EXCEPTION 'Instalment with a cost but no quote accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
ROLLBACK;
