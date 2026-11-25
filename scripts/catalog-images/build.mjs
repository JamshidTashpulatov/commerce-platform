#!/usr/bin/env node
// Build standard catalog images (docs/CATALOG-IMAGES.md) from the live catalog.
//
//   node scripts/catalog-images/build.mjs --work <dir> [--api <origin>] [--only <text>]
//
// Read-only: it reads the public catalog API and image URLs, never the
// database, and writes only inside --work (keep it outside the repo):
//   items.json            every active variant the API returned
//   src/<key>.*           downloaded sources (cached; delete to refetch)
//   cut/<key>.png         full-resolution transparent cut-outs
//   out/<key>.webp        the standard images
//   report.json           per image: source, checks, warnings
//   sheet-*.jpg           contact sheets on the card grey and on white
//
// Source order per image: a manual override from overrides.json, then Apple's
// own transparent master of the same asset, then the stored file with its
// plain studio background removed locally (cutout.swift + a colour matte).
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import sharp from "sharp";
import {CANVAS, TRIM_ALPHA, WEBP, appleAlphaSource, assetKey, placement} from "./standard.mjs";
import {matte} from "./matte.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const arg = name => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : undefined; };
const work = arg("work");
if (!work) { console.error("usage: build.mjs --work <dir> [--api <origin>] [--only <text>]"); process.exit(2); }
const api = arg("api") ?? "https://commerce-platform-tau.vercel.app";
const only = arg("only")?.toLowerCase();
for (const d of ["src", "cut", "out"]) mkdirSync(join(work, d), {recursive: true});
const overrides = JSON.parse(readFileSync(join(here, "overrides.json"), "utf8"));
const sha = s => createHash("sha256").update(s).digest("hex");

async function download(url, file) {
  if (existsSync(file)) return readFileSync(file);
  const r = await fetch(url, {headers: {"User-Agent": "Mozilla/5.0 (catalog image build)"}});
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const bytes = Buffer.from(await r.arrayBuffer());
  writeFileSync(file, bytes);
  return bytes;
}

async function catalogItems() {
  const items = [];
  let after = null;
  do {
    const r = await fetch(api + "/api/catalog" + (after ? "?after=" + after : ""));
    if (!r.ok) throw new Error("catalog API " + r.status);
    const page = await r.json();
    items.push(...page.items);
    after = page.items.length ? page.next : null;
  } while (after);
  return items;
}

/** Share of pixels that are see-through, and whether the border is clear. */
async function transparency(bytes) {
  const {data, info} = await sharp(bytes).resize(256, 256, {fit: "fill"}).ensureAlpha().extractChannel(3).raw().toBuffer({resolveWithObject: true});
  let clear = 0, edge = 0, edgeClear = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const a = data[y * info.width + x];
    if (a < 250) clear++;
    if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) { edge++; if (a < 16) edgeClear++; }
  }
  return {clear: clear / data.length, edgeClear: edgeClear / edge};
}

/** Alpha bounding box and which sides the subject touches. */
async function subjectBox(png) {
  const {data, info} = await sharp(png).ensureAlpha().extractChannel(3).raw().toBuffer({resolveWithObject: true});
  const W = info.width, H = info.height;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[y * W + x] >= TRIM_ALPHA) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  const touches = [x0 === 0 && "left", y0 === 0 && "top", x1 === W - 1 && "right", y1 === H - 1 && "bottom"].filter(Boolean);
  return {left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1, W, H, touches};
}

const swift = join(work, "cutout");
function visionMask(file) {
  // Compile once per work dir. Without Xcode tools the matte runs on colour alone.
  try {
    if (!existsSync(swift)) execFileSync("xcrun", ["swiftc", "-O", join(here, "cutout.swift"), "-o", swift], {stdio: "pipe"});
    const out = file.replace(/\.[^.]+$/, "") + ".vision.png";
    if (!existsSync(out)) execFileSync(swift, [file, out], {stdio: "pipe"});
    return out;
  } catch { return null; }
}

/** Every distinct image the catalog shows, with the products and variants using it. */
function collect(items) {
  const map = new Map();
  const use = (url, item, role) => {
    if (!url) return;
    const e = map.get(url) ?? {url, uses: [], category: item.category};
    e.uses.push({product: item.name, productId: item.id, variantId: item.variant_id, options: item.option_values, role});
    map.set(url, e);
  };
  for (const item of items) {
    use(item.image_url, item, "shown");
    for (const g of item.option_groups ?? []) for (const v of g.values) use(v.imageUrl, item, "option:" + g.name + "=" + v.label);
  }
  return [...map.values()];
}

/** Variant-level replacements from overrides.json (one shared photo split per colour). */
function variantSplits(items) {
  const extra = [];
  for (const rule of overrides.splitByOption ?? []) {
    for (const item of items.filter(i => i.name === rule.product)) {
      const value = item.option_values?.[rule.option];
      const url = rule.sources[value];
      if (url) extra.push({url, uses: [{product: item.name, productId: item.id, variantId: item.variant_id, options: item.option_values, role: "split:" + rule.option + "=" + value, replaces: item.image_url}], category: item.category});
    }
  }
  const map = new Map();
  for (const e of extra) { const x = map.get(e.url); if (x) x.uses.push(...e.uses); else map.set(e.url, e); }
  return [...map.values()];
}

async function processOne(entry) {
  const key = assetKey(entry.url, sha(entry.url));
  const asset = new URL(entry.url).pathname.split("/").pop();
  const rule = overrides.assets?.[asset] ?? {};
  const report = {key, url: entry.url, category: entry.category, products: [...new Set(entry.uses.map(u => u.product))], uses: entry.uses, warnings: []};
  // 1. Pick the best source.
  const candidates = [];
  if (rule.source) candidates.push({kind: "override", url: rule.source});
  const alpha = appleAlphaSource(entry.url);
  if (alpha && !rule.skipAppleAlpha) candidates.push({kind: "apple-alpha", url: alpha});
  candidates.push({kind: "stored", url: entry.url});
  let chosen = null;
  for (const c of candidates) {
    const file = join(work, "src", key + "." + c.kind);
    let bytes;
    try { bytes = await download(c.url, file); } catch (e) { report.warnings.push("source failed: " + c.kind + " " + e.message); continue; }
    const meta = await sharp(bytes).metadata().catch(() => null);
    if (!meta?.width) { report.warnings.push("source unreadable: " + c.kind); continue; }
    const t = await transparency(bytes);
    const transparent = meta.hasAlpha && t.clear > 0.05 && t.edgeClear > 0.5;
    if (c.kind !== "stored" && !transparent) { report.warnings.push(c.kind + " has no transparent background"); continue; }
    chosen = {...c, file, bytes, meta, transparent};
    break;
  }
  if (!chosen) { report.error = "no usable source"; return report; }
  report.source = {kind: chosen.kind, url: chosen.url, width: chosen.meta.width, height: chosen.meta.height, format: chosen.meta.format, transparent: chosen.transparent};
  // 2. Transparent cut-out at full resolution.
  const cutFile = join(work, "cut", key + ".png");
  if (chosen.transparent) {
    await sharp(chosen.bytes).ensureAlpha().png().toFile(cutFile);
    report.cut = "source alpha";
  } else {
    const vision = visionMask(chosen.file);
    const m = await matte(chosen.bytes, vision ? readFileSync(vision) : null, rule.matte ?? {});
    await sharp(m.data, {raw: m.info}).png().toFile(cutFile);
    report.cut = "local matte (background " + m.background + (vision ? ", Vision mask" : ", colour only") + ")";
    if (m.warning) report.warnings.push(m.warning);
  }
  // 3. Trim, fit, pad, export.
  const box = await subjectBox(cutFile);
  if (!box) { report.error = "empty cut-out"; return report; }
  if (box.touches.length && !rule.acceptEdge) report.warnings.push("subject touches source edge: " + box.touches.join(", ") + " (source may be cropped)");
  const place = placement(box.width, box.height, entry.category);
  if (place.factor > 1.25) report.warnings.push(`upscaled ${place.factor.toFixed(2)}x, source is small`);
  const subject = await sharp(cutFile).extract({left: box.left, top: box.top, width: box.width, height: box.height})
    .resize(place.width, place.height, {fit: "fill", kernel: "lanczos3"}).png().toBuffer();
  const outFile = join(work, "out", key + ".webp");
  await sharp({create: {width: CANVAS.width, height: CANVAS.height, channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0}}})
    .composite([{input: subject, left: place.left, top: place.top}]).webp(WEBP).toFile(outFile);
  const out = readFileSync(outFile);
  Object.assign(report, {out: outFile, bytes: out.length, sha256: sha(out), subject: {width: place.width, height: place.height, left: place.left, top: place.top}, scale: +place.factor.toFixed(3)});
  if (out.length > 1048576) report.warnings.push("output over 1 MiB");
  return report;
}

async function sheet(reports, file, background, field) {
  const T = 300, H = 200, L = 40, G = 10, cols = 6;
  const rows = Math.ceil(reports.length / cols);
  const comps = [];
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  for (const [i, r] of reports.entries()) {
    const x = G + (i % cols) * (T + G), y = G + Math.floor(i / cols) * (H + L + G);
    comps.push({input: {create: {width: T, height: H, channels: 4, background}}, left: x, top: y});
    const img = r[field];
    if (img && existsSync(img)) comps.push({input: await sharp(img).resize(T, H, {fit: "contain", background: {r: 0, g: 0, b: 0, alpha: 0}}).png().toBuffer(), left: x, top: y});
    const note = r.error ?? (r.warnings.length ? "! " + r.warnings[0] : r.cut ?? "");
    comps.push({input: Buffer.from(`<svg width="${T}" height="${H + L}"><rect x="0.5" y="0.5" width="${T - 1}" height="${H - 1}" fill="none" stroke="#d2d2d7"/><text x="4" y="${H + 16}" font-family="Helvetica" font-size="13" fill="#1d1d1f">${esc(r.products.join(", ")).slice(0, 40)}</text><text x="4" y="${H + 32}" font-family="Helvetica" font-size="10" fill="${r.error || r.warnings.length ? "#c00" : "#6e6e73"}">${esc(note).slice(0, 58)}</text></svg>`), left: x, top: y});
  }
  await sharp({create: {width: cols * (T + G) + G, height: rows * (H + L + G) + G, channels: 3, background: "#ffffff"}}).composite(comps).jpeg({quality: 85}).toFile(file);
}

const items = await catalogItems();
writeFileSync(join(work, "items.json"), JSON.stringify(items, null, 1));
const splits = variantSplits(items);
const splitVariants = new Set(splits.flatMap(e => e.uses.map(u => u.variantId)));
// A shared photo that every one of its variants now replaces is not needed any more.
const shared = collect(items).filter(e => !e.uses.every(u => u.role === "shown" && splitVariants.has(u.variantId)));
let entries = [...shared, ...splits];
if (only) entries = entries.filter(e => e.uses.some(u => u.product.toLowerCase().includes(only)));
entries.sort((a, b) => a.category.localeCompare(b.category) || a.uses[0].product.localeCompare(b.uses[0].product) || a.url.localeCompare(b.url));
const reports = [];
for (const e of entries) {
  const r = await processOne(e);
  reports.push(r);
  console.log((r.error ? "FAIL " : r.warnings.length ? "WARN " : "ok   ") + r.products.join(", ") + "  " + (r.source?.kind ?? "") + "  " + [r.error, ...r.warnings].filter(Boolean).join("; "));
}
const products = new Set(items.map(i => i.id));
const withImage = new Set(items.filter(i => i.image_url).map(i => i.id));
const summary = {generatedAt: new Date().toISOString(), api, variants: items.length, products: products.size,
  productsWithoutImage: [...new Set(items.filter(i => !withImage.has(i.id)).map(i => i.name))],
  images: reports.length, failed: reports.filter(r => r.error).length, warned: reports.filter(r => r.warnings.length).length};
writeFileSync(join(work, "report.json"), JSON.stringify({summary, images: reports}, null, 1));
await sheet(reports, join(work, "sheet-after-grey.jpg"), "#f5f5f7", "out");
await sheet(reports, join(work, "sheet-after-white.jpg"), "#ffffff", "out");
console.log(JSON.stringify(summary));
