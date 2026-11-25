BEGIN;
ALTER TABLE products ADD COLUMN image_url text CHECK(image_url IS NULL OR length(image_url)<=2048);
ALTER TABLE products ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK(revision>=0);
ALTER TABLE products ADD COLUMN request_key uuid;
ALTER TABLE products ADD CONSTRAINT product_request_unique UNIQUE(store_id,request_key);
ALTER TABLE variants ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK(revision>=0);
ALTER TABLE variants ADD COLUMN request_key uuid;
ALTER TABLE variants ADD CONSTRAINT variant_request_unique UNIQUE(store_id,request_key);
COMMIT;
