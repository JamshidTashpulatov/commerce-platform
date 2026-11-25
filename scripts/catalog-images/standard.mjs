// The Tech Store catalog image standard (see docs/CATALOG-IMAGES.md).
// Shared by the build script and the tests so the numbers live in one place.

/** Every catalog image is exactly this canvas: 3:2, the shape of a catalog card. */
export const CANVAS = {width: 1500, height: 1000};

/**
 * The safe box the subject is fitted into, as a share of the canvas. The rest
 * is transparent padding, so every card shows the same breathing room.
 */
export const SAFE_BOX = {width: 0.84, height: 0.84};

/**
 * Per-category size inside the safe box, so products in one category share
 * one scale and a small accessory does not fill the frame like a laptop.
 */
export const CATEGORY_SCALE = {
  iPhone: 0.92,
  iPad: 0.96,
  Mac: 1,
  "Apple Watch": 0.86,
  AirPods: 0.82,
  Vision: 0.92,
  Home: 0.86,
  Aksessuarlar: 0.9,
};

/** Alpha below this counts as empty when trimming (faint stray pixels). */
export const TRIM_ALPHA = 8;

/** WebP with alpha. The upload route re-encodes at quality 82 on save. */
export const WEBP = {quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true};

/** Where the fitted subject goes on the canvas, centred. Pure, for tests. */
export function placement(subjectWidth, subjectHeight, category) {
  const scale = CATEGORY_SCALE[category] ?? 0.9;
  const boxW = CANVAS.width * SAFE_BOX.width * scale;
  const boxH = CANVAS.height * SAFE_BOX.height * scale;
  const factor = Math.min(boxW / subjectWidth, boxH / subjectHeight);
  const width = Math.max(1, Math.round(subjectWidth * factor));
  const height = Math.max(1, Math.round(subjectHeight * factor));
  return {
    width, height, factor,
    left: Math.round((CANVAS.width - width) / 2),
    top: Math.round((CANVAS.height - height) / 2),
  };
}

/**
 * Apple's image CDN serves any size and format of an asset when the version
 * token is left out. Ask for the transparent master at up to twice the stored
 * size, so the trimmed subject keeps enough pixels after the cut.
 */
export function appleAlphaSource(raw) {
  let url;
  try { url = new URL(raw); } catch { return null; }
  if (url.hostname !== "store.storeimages.cdn-apple.com") return null;
  const wid = Number(url.searchParams.get("wid")), hei = Number(url.searchParams.get("hei"));
  if (!wid || !hei) return null;
  const k = Math.max(1, Math.min(2, 2400 / Math.max(wid, hei)));
  const out = new URL(url.origin + url.pathname);
  out.searchParams.set("wid", String(Math.round(wid * k)));
  out.searchParams.set("hei", String(Math.round(hei * k)));
  out.searchParams.set("fmt", "png-alpha");
  return out.toString();
}

/** A stable, readable file key for an image URL: asset name plus a short hash. */
export function assetKey(raw, hash) {
  let name = "image";
  try { name = new URL(raw).pathname.split("/").pop() || name; } catch { /* keep default */ }
  return name.replace(/\.[a-z]+$/i, "").replace(/[^\w-]+/g, "-").slice(0, 80) + "-" + hash.slice(0, 8);
}
