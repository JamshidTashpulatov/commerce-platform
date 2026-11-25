BEGIN;
ALTER TABLE products ADD COLUMN option_groups jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(option_groups)='array');
ALTER TABLE variants ADD COLUMN option_values jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(option_values)='object');
ALTER TABLE variants ADD COLUMN image_url text CHECK(image_url IS NULL OR length(image_url)<=2048);
-- For dynamic products each combination is a single SKU. Empty legacy values are excluded.
CREATE UNIQUE INDEX variant_dynamic_combination ON variants(store_id,product_id,option_values) WHERE option_values <> '{}'::jsonb;
COMMIT;
