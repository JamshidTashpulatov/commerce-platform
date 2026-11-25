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

// Images are decoded and normalised before the transaction opens, and rows are
// changed in a few set-based statements, so locks are held for seconds, not
// minutes. A deadlock or serialization failure rolls everything back and the
// whole transaction is retried.
const plan = [];
if (work) {
  const {images} = JSON.parse(readFileSync(join(work, "report.json"), "utf8"));
  for (const image of images) {
    if (image.error || !image.out) { plan.push({image, skip: image.error ?? "no output"}); continue; }
    plan.push({image, bytes: await normaliseCatalogImage(readFileSync(image.out), "image/webp")});
  }
}

const client = new pg.Client({connectionString: DATABASE_URL});
await client.connect();

/**
 * Lock, then change rows [{id, from, to, reason}] of one table, only where the
 * row still holds `from`. Returns what changed and what did not.
 */
async function swapAll(table, rows, actor) {
  if (!rows.length) return {changed: [], skipped: []};
  const ids = rows.map(r => r.id), from = rows.map(r => r.from), to = rows.map(r => r.to);
  await client.query(`SELECT id FROM ${table} WHERE store_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE`, [STORE_ID, ids]);
  const r = await client.query(`UPDATE ${table} t SET image_url=x.to_url, revision=t.revision+1
    FROM unnest($2::uuid[],$3::text[],$4::text[]) AS x(id,from_url,to_url)
    WHERE t.store_id=$1 AND t.id=x.id AND t.image_url=x.from_url RETURNING t.id,t.revision`, [STORE_ID, ids, from, to]);
  const done = new Map(r.rows.map(x => [x.id, x.revision]));
  await client.query(`INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id)
    SELECT $1,$2,'catalog_image_replaced',$3,id FROM unnest($4::uuid[]) AS id`,
    [STORE_ID, actor, table === "products" ? "product" : "variant", [...done.keys()]]);
  return {
    changed: rows.filter(x => done.has(x.id)).map(x => ({table, ...x, revision: done.get(x.id)})),
    skipped: rows.filter(x => !done.has(x.id)).map(x => ({table, id: x.id, from: x.from, reason: "image changed since the build"})),
  };
}

async function run() {
  const changes = [], skipped = plan.filter(p => p.skip).map(p => ({url: p.image.url, reason: p.skip}));
  await client.query("BEGIN");
  await client.query("SELECT id FROM stores WHERE id=$1 FOR UPDATE", [STORE_ID]);
  // Recorded as the uploader, like an admin upload: the owner, or else an admin.
  const owner = await client.query("SELECT account_id FROM memberships WHERE store_id=$1 AND role IN ('owner','admin') ORDER BY role='owner' DESC,account_id LIMIT 1", [STORE_ID]);
  if (!owner.rowCount) throw new Error("store has no owner or admin membership");
  const actor = owner.rows[0].account_id;
  const rows = {products: [], variants: []};
  if (restoreFile) {
    const saved = JSON.parse(readFileSync(restoreFile, "utf8"));
    for (const c of saved.changes) rows[c.table].push({id: c.id, from: c.to, to: c.from, reason: "restore"});
  } else {
    const opts = await client.query(`SELECT count(*)::int AS n FROM products p, jsonb_array_elements(p.option_groups) g, jsonb_array_elements(g->'values') v
      WHERE p.store_id=$1 AND v->>'imageUrl' IS NOT NULL`, [STORE_ID]);
    if (opts.rows[0].n) throw new Error(opts.rows[0].n + " option values carry their own image; this script does not rewrite option images yet");
    const byUrl = new Map();
    for (const p of plan) {
      if (p.skip) continue;
      const {url} = await saveCatalogImage(client, STORE_ID, actor, p.bytes);
      const split = p.image.uses.filter(u => u.role.startsWith("split:"));
      if (split.length) {
        for (const u of split) rows.variants.push({id: u.variantId, from: u.replaces, to: url, reason: u.role});
        // The product's own cover, if it was the shared photo, takes the first colour's photo.
        for (const u of split) if (!rows.products.some(r => r.id === u.productId)) rows.products.push({id: u.productId, from: u.replaces, to: url, reason: "cover from " + u.role, optional: true});
      } else byUrl.set(p.image.url, url);
    }
    // Every product and variant row that stores a built URL, active or not.
    for (const table of ["products", "variants"]) {
      const r = await client.query(`SELECT id,image_url FROM ${table} WHERE store_id=$1 AND image_url=ANY($2::text[])`, [STORE_ID, [...byUrl.keys()]]);
      for (const x of r.rows) rows[table].push({id: x.id, from: x.image_url, to: byUrl.get(x.image_url), reason: "standard image"});
    }
  }
  for (const table of ["products", "variants"]) {
    const res = await swapAll(table, rows[table], actor);
    changes.push(...res.changed);
    // A product cover that was not the shared photo is simply left alone.
    skipped.push(...res.skipped.filter(s => !rows[table].find(r => r.id === s.id)?.optional));
  }
  const left = await client.query(`SELECT (SELECT count(*) FROM products WHERE store_id=$1 AND image_url LIKE 'https://%')::int AS products,
    (SELECT count(*) FROM variants WHERE store_id=$1 AND active AND image_url LIKE 'https://%')::int AS variants,
    (SELECT count(*) FROM catalog_media WHERE store_id=$1)::int AS media`, [STORE_ID]);
  return {changes, skipped, left: left.rows[0]};
}

try {
  let result;
  for (let attempt = 1; ; attempt++) {
    try { result = await run(); break; } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      if (!["40P01", "40001"].includes(e.code) || attempt >= 3) throw e;
      console.log(`attempt ${attempt}: ${e.message}; retrying`);
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  const {changes, skipped, left} = result;
  const summary = {mode: restoreFile ? "restore" : "apply", committed: commit, changed: changes.length,
    variants: changes.filter(c => c.table === "variants").length, products: changes.filter(c => c.table === "products").length,
    skipped: skipped.length, after: left};
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
