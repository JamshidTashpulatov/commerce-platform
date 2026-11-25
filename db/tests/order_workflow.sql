BEGIN;
DO $$
DECLARE st uuid; account uuid; product uuid; variant uuid; ord uuid; request_id uuid:=gen_random_uuid();
BEGIN
 INSERT INTO stores(name) VALUES('Workflow fixture') RETURNING id INTO st;
 INSERT INTO accounts DEFAULT VALUES RETURNING id INTO account;
 INSERT INTO memberships(store_id,account_id,role) VALUES(st,account,'seller');
 INSERT INTO products(store_id,name,category) VALUES(st,'Fixture','Test') RETURNING id INTO product;
 INSERT INTO variants(store_id,product_id,sku,color,storage_label,price_uzs,quantity) VALUES(st,product,'W-1','Oq','512 GB',1000,3) RETURNING id INTO variant;
 INSERT INTO orders(store_id,created_by,request_key,source) VALUES(st,account,request_id,'staff') RETURNING id INTO ord;
 INSERT INTO order_items(store_id,order_id,variant_id,quantity,unit_price_uzs) VALUES(st,ord,variant,2,1000);
 IF (SELECT quantity FROM variants WHERE id=variant)<>3 THEN RAISE EXCEPTION 'Draft affected inventory'; END IF;
 BEGIN
  INSERT INTO orders(store_id,created_by,request_key,source) VALUES(st,account,request_id,'staff');
  RAISE EXCEPTION 'Duplicate request accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  UPDATE orders SET sale_status='invalid' WHERE id=ord;
  RAISE EXCEPTION 'Invalid sale status accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 UPDATE variants SET quantity=quantity-2 WHERE id=variant AND quantity>=2;
 IF NOT FOUND THEN RAISE EXCEPTION 'Expected stock update'; END IF;
 UPDATE variants SET quantity=quantity-2 WHERE id=variant AND quantity>=2;
 IF FOUND THEN RAISE EXCEPTION 'Oversold stock'; END IF;
END $$;
ROLLBACK;
