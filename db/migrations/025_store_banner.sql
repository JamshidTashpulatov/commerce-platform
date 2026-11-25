BEGIN;
-- Short muted videos for the banner. 4 MB each: uploads go through a serverless request.
CREATE TABLE banner_videos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL REFERENCES stores(id),
 content_type text NOT NULL CHECK(content_type IN ('video/mp4','video/webm')),
 content_sha256 text NOT NULL CHECK(content_sha256 ~ '^[0-9a-f]{64}$'),
 video_bytes bytea NOT NULL CHECK(octet_length(video_bytes) BETWEEN 1 AND 4194304),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(store_id,content_sha256),
 FOREIGN KEY(store_id,created_by) REFERENCES memberships(store_id,account_id)
);
-- The banner at the top of the storefront home page, edited in the staff workspace.
-- One per store. Until one is published, the home page leads with the iPhone flagship.
CREATE TABLE store_banners (
 store_id uuid PRIMARY KEY REFERENCES stores(id),
 eyebrow text NOT NULL DEFAULT '' CHECK(length(eyebrow)<=40),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 80),
 subtitle text NOT NULL DEFAULT '' CHECK(length(subtitle)<=200),
 image_url text CHECK(image_url IS NULL OR length(image_url)<=2048),
 video_url text CHECK(video_url IS NULL OR video_url ~ '^/api/banner/video/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
 primary_label text NOT NULL DEFAULT '' CHECK(length(primary_label)<=30),
 primary_href text NOT NULL DEFAULT '' CHECK(length(primary_href)<=300),
 secondary_label text NOT NULL DEFAULT '' CHECK(length(secondary_label)<=30),
 secondary_href text NOT NULL DEFAULT '' CHECK(length(secondary_href)<=300),
 published boolean NOT NULL DEFAULT false,
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 updated_by uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((primary_label='')=(primary_href='')),
 CHECK((secondary_label='')=(secondary_href='')),
 FOREIGN KEY(store_id,updated_by) REFERENCES memberships(store_id,account_id)
);
COMMIT;
