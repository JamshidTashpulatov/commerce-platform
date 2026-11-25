BEGIN;
DO $$
DECLARE
 a uuid; b uuid; o uuid; c uuid; s uuid; investor uuid; invoice uuid; supplier uuid; receipt_key uuid:=gen_random_uuid();
BEGIN
 INSERT INTO stores(name) VALUES('Finance test A') RETURNING id INTO a;
 INSERT INTO stores(name) VALUES('Finance test B') RETURNING id INTO b;
 INSERT INTO accounts DEFAULT VALUES RETURNING id INTO investor;
 INSERT INTO memberships(store_id,account_id,role) VALUES(a,investor,'investor');
 INSERT INTO orders(store_id) VALUES(a) RETURNING id INTO o;
 INSERT INTO installment_contracts(store_id,order_id,contract_total_uzs,initial_payment_uzs) VALUES(a,o,1000,100) RETURNING id INTO c;
 INSERT INTO installment_schedule(store_id,contract_id,sequence_no,due_date,amount_uzs) VALUES(a,c,1,current_date,900) RETURNING id INTO s;
 BEGIN
  INSERT INTO installment_schedule(store_id,contract_id,sequence_no,due_date,amount_uzs) VALUES(b,c,2,current_date,900);
  RAISE EXCEPTION 'Cross-store schedule accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 INSERT INTO investor_capital_events(store_id,investor_account_id,event_type,amount_uzs,idempotency_key) VALUES(a,investor,'contribution',5000,receipt_key);
 BEGIN
  INSERT INTO investor_capital_events(store_id,investor_account_id,event_type,amount_uzs,idempotency_key) VALUES(a,investor,'contribution',5000,receipt_key);
  RAISE EXCEPTION 'Duplicate capital event accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  INSERT INTO investor_capital_events(store_id,investor_account_id,event_type,amount_uzs,idempotency_key) VALUES(b,investor,'contribution',5000,gen_random_uuid());
  RAISE EXCEPTION 'Cross-store investor event accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 INSERT INTO suppliers(store_id,display_name) VALUES(a,'Fixture') RETURNING id INTO supplier;
 INSERT INTO supplier_invoices(store_id,supplier_id,amount_uzs) VALUES(a,supplier,2000) RETURNING id INTO invoice;
 BEGIN
  INSERT INTO supplier_payments(store_id,invoice_id,amount_uzs,idempotency_key) VALUES(a,invoice,-100,gen_random_uuid());
  RAISE EXCEPTION 'Negative supplier payment accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
ROLLBACK;
