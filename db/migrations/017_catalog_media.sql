BEGIN;
CREATE TABLE catalog_media (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL REFERENCES stores(id),
 content_sha256 text NOT NULL CHECK(content_sha256 ~ '^[0-9a-f]{64}$'),
 image_bytes bytea NOT NULL CHECK(octet_length(image_bytes) BETWEEN 1 AND 1048576),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(store_id,content_sha256),
 FOREIGN KEY(store_id,created_by) REFERENCES memberships(store_id,account_id)
);
COMMIT;
