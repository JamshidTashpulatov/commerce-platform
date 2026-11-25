BEGIN;
DO $$
DECLARE st uuid; account uuid; product uuid; variant uuid; checkout uuid;
BEGIN
 INSERT INTO stores(name) VALUES('Checkout fixture') RETURNING id INTO st;
 INSERT INTO accounts DEFAULT VALUES RETURNING id INTO account;
 INSERT INTO products(store_id,name,category,published) VALUES(st,'Fixture','Test',true) RETURNING id INTO product;
 INSERT INTO variants(store_id,product_id,sku,color,price_uzs,quantity) VALUES(st,product,'WC-1','Oq',1000,0) RETURNING id INTO variant;
 BEGIN
  INSERT INTO orders(store_id,source) VALUES(st,'website');
  RAISE EXCEPTION 'Website order without checkout accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  INSERT INTO website_checkouts(store_id,reference,request_key,channel,name_cipher,phone_cipher,phone_lookup,line_count)
  VALUES(st,'MT-ABC',gen_random_uuid(),'cart','x','y',repeat('a',64),1);
  RAISE EXCEPTION 'Malformed reference accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 INSERT INTO website_checkouts(store_id,reference,request_key,channel,name_cipher,phone_cipher,phone_lookup,line_count)
 VALUES(st,'MT-AB12CD34',gen_random_uuid(),'cart','x','y',repeat('a',64),1) RETURNING id INTO checkout;
 BEGIN
  INSERT INTO website_checkouts(store_id,reference,request_key,channel,name_cipher,phone_cipher,phone_lookup,line_count)
  VALUES(st,'MT-AB12CD34',gen_random_uuid(),'cart','x','y',repeat('a',64),1);
  RAISE EXCEPTION 'Duplicate reference accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  INSERT INTO website_checkouts(store_id,reference,request_key,channel,name_cipher,phone_cipher,phone_lookup,line_count)
  VALUES(st,'MT-ZZ12CD34',gen_random_uuid(),'phone','x','y',repeat('a',64),1);
  RAISE EXCEPTION 'Unknown channel accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 INSERT INTO orders(store_id,source,website_checkout_id) VALUES(st,'website',checkout);
 BEGIN
  INSERT INTO website_checkout_attempts(store_id,bucket) VALUES(st,'ip:127.0.0.1');
  RAISE EXCEPTION 'Raw address stored as bucket';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  INSERT INTO customer_sessions(token_hash,store_id,account_id,expires_at) VALUES('short',st,account,now());
  RAISE EXCEPTION 'Malformed customer session accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF (SELECT quantity FROM variants WHERE id=variant)<>0 THEN RAISE EXCEPTION 'Checkout touched stock'; END IF;
END $$;
ROLLBACK;
