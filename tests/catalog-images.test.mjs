import {test} from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {CANVAS, SAFE_BOX, CATEGORY_SCALE, appleAlphaSource, assetKey, placement} from "../scripts/catalog-images/standard.mjs";
import {matte} from "../scripts/catalog-images/matte.mjs";
import {MediaError, normaliseCatalogImage} from "../lib/server/catalog-media-store.ts";

test("every subject fits the category box, centred on the 3:2 canvas", () => {
  for (const [category, scale] of Object.entries(CATEGORY_SCALE)) {
    for (const [w, h] of [[400, 1200], [3000, 900], [500, 500], [37, 21]]) {
      const p = placement(w, h, category);
      assert.ok(p.width <= Math.ceil(CANVAS.width * SAFE_BOX.width * scale));
      assert.ok(p.height <= Math.ceil(CANVAS.height * SAFE_BOX.height * scale));
      assert.ok(Math.abs(p.left * 2 + p.width - CANVAS.width) <= 1);
      assert.ok(Math.abs(p.top * 2 + p.height - CANVAS.height) <= 1);
      assert.ok(p.left > 0 && p.top > 0, "never touches the canvas edge");
    }
  }
  assert.equal(CANVAS.width / CANVAS.height, 1.5);
});

test("same category, same box: a tall phone and a tall tablet get the same height", () => {
  assert.equal(placement(500, 1000, "iPhone").height, placement(800, 1000, "iPhone").height);
});

test("Apple alpha source drops the version token and asks for png-alpha", () => {
  const u = appleAlphaSource("https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/airpods-5-select-202609_FV1?wid=976&hei=916&fmt=jpeg&qlt=90&.v=abc");
  assert.equal(u, "https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/airpods-5-select-202609_FV1?wid=1952&hei=1832&fmt=png-alpha");
  assert.match(appleAlphaSource("https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/x?wid=5120&hei=2880&fmt=jpeg"), /wid=5120&hei=2880/);
  assert.equal(appleAlphaSource("https://cdsassets.apple.com/live/x/images/tech-specs/a.png"), null);
  assert.equal(appleAlphaSource("/api/catalog/media/1"), null);
  assert.equal(assetKey("https://x/1/is/iphone-16-white?wid=1", "abcdef0123"), "iphone-16-white-abcdef01");
});

test("matte removes a white studio background without a white halo", async () => {
  // A grey disc with a soft edge on pure white.
  const svg = `<svg width="200" height="200"><rect width="200" height="200" fill="#ffffff"/><circle cx="100" cy="100" r="60" fill="#808080"/></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const m = await matte(png, null);
  assert.equal(m.background, "rgb(255,255,255)");
  const at = (x, y) => m.data.subarray((y * 200 + x) * 4, (y * 200 + x) * 4 + 4);
  assert.equal(at(5, 5)[3], 0, "corner is transparent");
  assert.equal(at(100, 100)[3], 255, "centre is opaque");
  assert.ok(Math.abs(at(100, 100)[0] - 128) <= 1);
  // Partly transparent edge pixels are un-mixed from white: no light fringe.
  for (let x = 30; x < 50; x++) {
    const p = at(x, 100);
    if (p[3] > 0 && p[3] < 255) assert.ok(p[0] < 160, `edge pixel at ${x} is not whitened (${p[0]})`);
  }
  assert.equal(m.warning, null);
});

test("matte keeps light enclosed parts that only colour would flood", async () => {
  // A white square with a dark outline on white: the inside is not connected to the border.
  const svg = `<svg width="120" height="120"><rect width="120" height="120" fill="#fff"/><rect x="30" y="30" width="60" height="60" fill="#fff" stroke="#333" stroke-width="4"/></svg>`;
  const m = await matte(await sharp(Buffer.from(svg)).png().toBuffer(), null);
  assert.equal(m.data[(60 * 120 + 60) * 4 + 3], 255);
});

test("shared normaliser rejects mismatched formats and keeps WebP alpha", async () => {
  const png = await sharp({create: {width: 30, height: 20, channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0}}}).png().toBuffer();
  await assert.rejects(normaliseCatalogImage(png, "image/webp"), e => e instanceof MediaError && e.status === 415);
  const webp = await sharp(png).webp().toBuffer();
  const out = await normaliseCatalogImage(webp, "image/webp");
  const meta = await sharp(out).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.hasAlpha, true);
});
