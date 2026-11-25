# Home page banner

The block at the top of the storefront home page is edited in the staff workspace under **Katalog va ombor → Bosh sahifa banneri** (`/staff/banner`, owner and admin only, needs `CATALOG_ADMIN_ENABLED=true` to save).

- Fields: eyebrow, title, subtitle, image, video, two buttons (label and link), published or draft. One banner per store (`store_banners`, migration 025).
- Button links are a path on this site (`/catalog?category=iPhone`) or an `https` address; the latter opens in a new tab. A button needs both a label and a link.
- Image: uploaded like catalog images (`/api/catalog/media/…`) or an approved catalog image host. The hero background takes the image's edge colour, and text turns light on a dark image.
- Video: MP4 or WebM, up to 4 MB (serverless request bodies are limited to about 4.5 MB), stored in `banner_videos` and served by `/api/banner/video/[id]` with byte ranges. It plays muted and looped, with a pause button, and does not start by itself when the visitor prefers reduced motion. The image is its poster, so use the video's first frame.
- Uploaded media are public only while a published banner (or product) uses them.
- Saving checks the revision, so two editors cannot overwrite each other silently.
- Without a published banner, the home page leads with the most expensive iPhone, as before.
