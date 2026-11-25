# Catalog image standard

Every product, variant and option image in the catalog follows one standard, so
cards and product pages show all products the same way.

| Rule | Value |
|---|---|
| Canvas | 1500 × 1000 px, 3:2 (the shape of a catalog card). Sharp on 2× and 3× phones and on the 620 px product gallery at 2×. |
| Background | Fully transparent. The card's own grey (`#f5f5f7`) or white shows through. |
| Subject | Never cropped, centred, trimmed to its pixels and fitted into a safe box of 84 % × 84 % of the canvas, so at least 8 % padding is left on every side. |
| Scale | One box per category (`CATEGORY_SCALE` in `scripts/catalog-images/standard.mjs`): iPhone 0.92, iPad 0.96, Mac 1, Apple Watch 0.86, AirPods 0.82, Vision 0.92, Home 0.86, Aksessuarlar 0.9. Products in one category share one box. |
| Edges | Anti-aliased, colours un-mixed from the old background, so no white or grey halo. Faint contact shadows fade to transparent. |
| Format | WebP with alpha. The upload path re-encodes it at quality 82, keeping alpha; files are usually 40 to 200 KB. |
| Storage | In our own database (`catalog_media`), served from `/api/catalog/media/<id>`. No Apple CDN links at run time. |

Because the canvas has the card's own 3:2 shape, the storefront needs no
special case: a 3:2 card and the product gallery (which takes the photo's
ratio) show the whole canvas, and the padding keeps the subject clear of the
small 4:3 thumbnails' crop. A transparent image never paints its tile
(`imageTone` in `lib/server/storefront.ts` returns no tone when the edges are
clear; opaque uploads such as banner photos still get their edge colour). If a
card shape ever changes from 3:2, change `CANVAS` and rebuild, or show catalog
images with `object-contain`.

## Making the images

`scripts/catalog-images/build.mjs` is read-only and repeatable. It reads the
public catalog API and writes into a work folder you name (keep it outside the
repo):

```bash
node scripts/catalog-images/build.mjs --work ~/catalog-images-work
```

For each image the catalog shows it picks the best source, in this order:

1. A manual override in `scripts/catalog-images/overrides.json`. `splitByOption`
   gives each colour its own photo where one shared photo showed every colour
   (iPhone 16 Plus).
2. Apple's own transparent master of the same asset (the stored URL without its
   version token, `fmt=png-alpha`, up to twice the stored size).
3. The stored file, with its plain studio background removed locally:
   `cutout.swift` (Apple Vision, on-device, macOS 14+) protects light parts of the
   product, and `matte.mjs` removes the background colour read from the border.
   Nothing is sent to an outside service.

It then trims, fits, centres and exports, and writes `report.json` (source,
checks and warnings per image) and contact sheets on grey and on white. Look at
both sheets: white products (AirPods, silver devices) are the hard cases. A
warning such as "subject touches source edge" means the source itself is cut,
and the image needs a better source in `overrides.json`.

## Putting them in the catalog

`scripts/catalog-images/apply.mjs` stores the images through the same code as
the admin upload (`lib/server/catalog-media-store.ts`: normalisation, dedupe by
SHA-256, quota, audit event) and points product and variant rows at them, all in
one transaction:

```bash
DATABASE_URL=... STORE_ID=... node scripts/catalog-images/apply.mjs --work ~/catalog-images-work            # dry run
DATABASE_URL=... STORE_ID=... node scripts/catalog-images/apply.mjs --work ~/catalog-images-work --commit
```

* A row changes only while it still holds the exact URL the build saw, so an
  image edited in the admin since then is skipped, not overwritten.
* Only `image_url` and `revision` change. Prices, stock, names and options do
  not. Nothing is deleted.
* With `--commit` it writes `restore-<time>.json`, listing every row with its
  old and new URL. `--restore <file> --commit` puts the old URLs back, again only
  where the row still holds the new one.

This is a production data change: run it only with the owner's approval.
