BEGIN;
DO $$
DECLARE
  store_a uuid; store_b uuid; admin_a uuid; investor_a uuid; investor_b uuid; outsider uuid;
  lookup text := repeat('a',64);
BEGIN
  INSERT INTO stores(name) VALUES ('Phone A') RETURNING id INTO store_a;
  INSERT INTO stores(name) VALUES ('Phone B') RETURNING id INTO store_b;
  INSERT INTO accounts DEFAULT VALUES RETURNING id INTO admin_a;
  INSERT INTO accounts DEFAULT VALUES RETURNING id INTO investor_a;
  INSERT INTO accounts DEFAULT VALUES RETURNING id INTO investor_b;
  INSERT INTO accounts DEFAULT VALUES RETURNING id INTO outsider;
  INSERT INTO memberships(store_id,account_id,role) VALUES (store_a,admin_a,'admin'),(store_a,investor_a,'investor'),(store_a,investor_b,'investor');
  INSERT INTO account_sign_in_phones(store_id,account_id,phone_cipher,phone_lookup,created_by) VALUES (store_a,investor_a,'v1.x.y.z',lookup,admin_a);
  BEGIN
    INSERT INTO account_sign_in_phones(store_id,account_id,phone_cipher,phone_lookup,created_by) VALUES (store_a,investor_b,'v1.x.y.z',lookup,admin_a);
    RAISE EXCEPTION 'Duplicate sign-in phone accepted in one store';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO account_sign_in_phones(store_id,account_id,phone_cipher,phone_lookup,created_by) VALUES (store_a,investor_b,'v1.x.y.z','+998901234567',admin_a);
    RAISE EXCEPTION 'Plain phone accepted as lookup value';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO account_sign_in_phones(store_id,account_id,phone_cipher,phone_lookup,created_by) VALUES (store_a,outsider,'v1.x.y.z',repeat('b',64),admin_a);
    RAISE EXCEPTION 'Sign-in phone accepted for an account without a membership';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO account_sign_in_phones(store_id,account_id,phone_cipher,phone_lookup,created_by) VALUES (store_b,investor_a,'v1.x.y.z',repeat('c',64),admin_a);
    RAISE EXCEPTION 'Cross-store sign-in phone accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  INSERT INTO telegram_webhook_updates(update_id) VALUES (1);
  BEGIN
    INSERT INTO telegram_webhook_updates(update_id) VALUES (1);
    RAISE EXCEPTION 'Repeated webhook update accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;
ROLLBACK;
