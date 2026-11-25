BEGIN;
CREATE TABLE admin_credentials (
 store_id uuid NOT NULL, account_id uuid NOT NULL, email text NOT NULL CHECK(email=lower(trim(email))),
 salt bytea, password_hash bytea, attempts integer NOT NULL DEFAULT 0, window_start timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(store_id,account_id), UNIQUE(store_id,email),
 CHECK((salt IS NULL AND password_hash IS NULL) OR (salt IS NOT NULL AND password_hash IS NOT NULL AND octet_length(salt)=16 AND octet_length(password_hash)=64)),
 FOREIGN KEY(store_id,account_id) REFERENCES memberships(store_id,account_id)
);
CREATE TABLE admin_login_limits (
 store_id uuid PRIMARY KEY REFERENCES stores(id), attempts integer NOT NULL, window_start timestamptz NOT NULL
);
ALTER TABLE sessions ADD COLUMN password_store_id uuid REFERENCES stores(id);
COMMIT;
