// Preserve the image format, resolution and version chosen by the Apple Store.
export function isAppleCatalogImage(url: URL): boolean {
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return false;
  if (url.hostname === "cdsassets.apple.com") {
    return /^\/live\/[a-zA-Z0-9]+\/images\/tech-specs\/[\w-]+\.(png|jpg)$/.test(url.pathname) && !url.search;
  }
  return url.hostname === "store.storeimages.cdn-apple.com" &&
    /^\/\d+\/as-images\.apple\.com\/is\/[\w.-]+$/.test(url.pathname) &&
    [...url.searchParams.keys()].every(key => ["wid", "hei", "fmt", "qlt", ".v", "traceId"].includes(key));
}
