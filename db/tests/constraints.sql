BEGIN;
DO $$
DECLARE
  store_a uuid;
  store_b uuid;
  product_a uuid;
  variant_a uuid;
  order_b uuid;
BEGIN
  INSERT INTO stores(name) VALUES ('Test A') RETURNING id INTO store_a;
  INSERT INTO stores(name) VALUES ('Test B') RETURNING id INTO store_b;
  INSERT INTO products(store_id,name,category,published) VALUES (store_a,'Fixture','Test',true) RETURNING id INTO product_a;
  INSERT INTO variants(store_id,product_id,sku,color,price_uzs,quantity)
    VALUES (store_a,product_a,'TEST','White',1000,2) RETURNING id INTO variant_a;
  INSERT INTO orders(store_id) VALUES(store_b) RETURNING id INTO order_b;
  BEGIN
    INSERT INTO order_items(store_id,order_id,variant_id,quantity,unit_price_uzs)
      VALUES(store_b,order_b,variant_a,1,1000);
    RAISE EXCEPTION 'Cross-store order item accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    UPDATE variants SET quantity=-1 WHERE id=variant_a;
    RAISE EXCEPTION 'Negative stock accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
ROLLBACK;
