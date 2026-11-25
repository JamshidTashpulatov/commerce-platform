BEGIN;
-- The model family a product belongs to on the storefront ("iPhone 18" for the 18 Pro and
-- Pro Max). Set in the catalog admin. NULL means the storefront derives it from the name.
ALTER TABLE products ADD COLUMN model text
  CHECK(model IS NULL OR (length(model) BETWEEN 1 AND 80 AND model=btrim(model)));
COMMIT;
