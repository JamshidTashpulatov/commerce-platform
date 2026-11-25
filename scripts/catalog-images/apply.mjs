#!/usr/bin/env node
// Replace catalog image references with the standard images from build.mjs.
//
//   DATABASE_URL=... STORE_ID=... node scripts/catalog-images/apply.mjs --work <dir>            (dry run)
//   DATABASE_URL=... STORE_ID=... node scripts/catalog-images/apply.mjs --work <dir> --commit
//   DATABASE_URL=... STORE_ID=... node scripts/catalog-images/apply.mjs --restore <restore.json> [--commit]
//
// One transaction. Images are stored with the same normalisation, dedupe,
// quota and audit as the admin upload route (lib/server/catalog-media-store.ts).
// A row is changed only while it still holds the exact image URL the build
// saw, so anything edited in the admin since then is left alone. Only
// image_url and revision change; prices, stock and everything else stay.
// No product, variant or media row is ever deleted. The old URLs are kept in
// restore-<time>.json next to the build, and --restore puts them back.
import {readFileSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import pg from "pg";
import {normaliseCatalogImage, saveCatalogImage} from "../../lib/server/catalog-media-store.ts";

const arg = name => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : undefined; };
const commit = process.argv.includes("--commit");
const {DATABASE_URL, STORE_ID} = process.env;
if (!DATABASE_URL || !STORE_ID) { console.error("DATABASE_URL and STORE_ID are required"); process.exit(2); }
const work = arg("work"), restoreFile = arg("restore");
if (!work === !restoreFile) { console.error("pass exactly one of --work <dir> or --restore <file>"); process.exit(2); }

const client = new pg.Client({connectionString: DATABASE_URL});
await client.connect();
const changes = [];
const skipped = [];
// Change one column of one row from `from` to `to`, only if it still holds `from`.
async function swap(table, id, from, to, reason) {
  const r = await client.query(`UPDATE ${table} SET image_url=$4, revision=revision+1 WHERE store_id=$1 AND id=$2 AND image_url=$3 RETURNING revision`, [STORE_ID, id, from, to]);
  if (!r.rowCount) { skipped.push({table, id, from, reason: "image changed since the build"}); return; }
  changes.push({table, id, from, to, revision: r.rows[0].revision, reason});
  await client.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'catalog_image_replaced',$3,$4)",
    [STORE_ID, actor, table === "products" ? "product" : "variant", id]);
}
let actor;
try {
  await client.query("BEGIN");
  await client.query("SELECT id FROM stores WHERE id=$1 FOR UPDATE", [STORE_ID]);
  const owner = await client.query("SELECT account_id FROM memberships WHERE store_id=$1 AND role='owner' ORDER BY account_id LIMIT 1", [STORE_ID]);
  if (!owner.rowCount) throw new Error("store has no owner membership");
  actor = owner.rows[0].account_id;
  if (restoreFile) {
    const saved = JSON.parse(readFileSync(restoreFile, "utf8"));
    for (const c of saved.changes) await swap(c.table, c.id, c.to, c.from, "restore");
  } else {
    const {images} = JSON.parse(readFileSync(join(work, "report.json"), "utf8"));
    const opts = await client.query(`SELECT count(*)::int AS n FROM products p, jsonb_array_elements(p.option_groups) g, jsonb_array_elements(g->'values') v
      WHERE p.store_id=$1 AND v->>'imageUrl' IS NOT NULL`, [STORE_ID]);
    if (opts.rows[0].n) throw new Error(opts.rows[0].n + " option values carry their own image; this script does not rewrite option images yet");
    for (const image of images) {
      if (image.error || !image.out) { skipped.push({url: image.url, reason: image.error ?? "no output"}); continue; }
      const bytes = await normaliseCatalogImage(readFileSync(image.out), "image/webp");
      const {url} = await saveCatalogImage(client, STORE_ID, actor, bytes);
      const split = image.uses.filter(u => u.role.startsWith("split:"));
      if (split.length) {
        for (const u of split) await swap("variants", u.variantId, u.replaces, url, u.role);
        // The product's own cover was the shared photo: it takes the first colour's photo.
        for (const u of split) {
          const p = await client.query("SELECT id FROM products WHERE store_id=$1 AND id=$2 AND image_url=$3", [STORE_ID, u.productId, u.replaces]);
          if (p.rowCount) await swap("products", u.productId, u.replaces, url, "cover from " + u.role);
        }
        continue;
      }
      // Every product and variant row that stores this URL, active or not.
      for (const table of ["products", "variants"]) {
        const rows = await client.query(`SELECT id FROM ${table} WHERE store_id=$1 AND image_url=$2 ORDER BY id`, [STORE_ID, image.url]);
        for (const row of rows.rows) await swap(table, row.id, image.url, url, "standard image");
      }
    }
  }
  const left = await client.query(`SELECT (SELECT count(*) FROM products WHERE store_id=$1 AND image_url LIKE 'https://%')::int AS products,
    (SELECT count(*) FROM variants WHERE store_id=$1 AND active AND image_url LIKE 'https://%')::int AS variants`, [STORE_ID]);
  const summary = {mode: restoreFile ? "restore" : "apply", committed: commit, changed: changes.length, skipped: skipped.length, externalUrlsLeft: left.rows[0]};
  if (commit) {
    const out = (restoreFile ? restoreFile.replace(/\.json$/, "") + "-undone-" : join(work, "restore-")) + new Date().toISOString().replace(/[:.]/g, "-") + ".json";
    writeFileSync(out, JSON.stringify({summary, changes, skipped}, null, 1));
    await client.query("COMMIT");
    console.log("committed; restore file:", out);
  } else {
    await client.query("ROLLBACK");
    console.log("dry run, rolled back. Pass --commit to apply.");
  }
  console.log(JSON.stringify(summary));
  for (const s of skipped) console.log("skipped", JSON.stringify(s));
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("rolled back:", e.message);
  process.exitCode = 1;
} finally { await client.end(); }
