BEGIN;
CREATE TABLE stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE memberships (
  store_id uuid NOT NULL REFERENCES stores(id),
  account_id uuid NOT NULL REFERENCES accounts(id),
  role text NOT NULL CHECK (role IN ('owner','admin','seller','investor','customer')),
  PRIMARY KEY (store_id, account_id)
);
CREATE TABLE sessions (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id),
  name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id,id)
);
CREATE TABLE variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  product_id uuid NOT NULL,
  sku text NOT NULL,
  color text NOT NULL,
  price_uzs bigint NOT NULL CHECK (price_uzs >= 0),
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  active boolean NOT NULL DEFAULT true,
  FOREIGN KEY (store_id,product_id) REFERENCES products(store_id,id),
  UNIQUE (store_id,id),
  UNIQUE (store_id,sku)
);
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id),
  customer_id uuid REFERENCES accounts(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','completed','cancelled')),
  currency text NOT NULL DEFAULT 'UZS' CHECK (currency = 'UZS'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id,id)
);
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  order_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_uzs bigint NOT NULL CHECK (unit_price_uzs >= 0),
  FOREIGN KEY (store_id,order_id) REFERENCES orders(store_id,id),
  FOREIGN KEY (store_id,variant_id) REFERENCES variants(store_id,id),
  UNIQUE(store_id,order_id,variant_id)
);
CREATE TABLE stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  delta integer NOT NULL CHECK (delta <> 0),
  reason text NOT NULL CHECK (reason IN ('receipt','sale','return','adjustment')),
  created_by uuid REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(store_id,variant_id) REFERENCES variants(store_id,id)
);
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id),
  actor_id uuid REFERENCES accounts(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_catalog_idx ON products (store_id,published,category);
CREATE INDEX orders_store_date_idx ON orders (store_id,created_at DESC);
CREATE INDEX stock_movements_variant_idx ON stock_movements(store_id,variant_id,created_at);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
COMMIT;
