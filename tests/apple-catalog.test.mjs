import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {isAppleCatalogImage} from "../lib/apple-catalog-image.ts";
import {validGroups,validSelection} from "../lib/catalog-options.ts";
import {importParameters} from "../scripts/apple-demo/import.mjs";

test("Apple demo variants have unique valid combinations and original Apple image URLs", async () => {
  const [,json] = await importParameters("test");
  const rows=JSON.parse(json);
  const catalog=JSON.parse(await readFile(new URL("../scripts/apple-demo/catalog.json",import.meta.url)));
  assert.equal(rows.length,41);
  assert.ok(catalog.images.every(url=>url.length<=2048 && isAppleCatalogImage(new URL(url))));
  for(const row of rows){
    assert.ok(validGroups(row.groups,()=>false), row.name);
    assert.equal(new Set(row.variants.map(v=>v.id)).size,row.variants.length);
    for(const v of row.variants){
      assert.ok(validSelection(row.groups,v.options),row.name);
      assert.ok(Number.isSafeInteger(v.delta) && v.delta>=0);
    }
  }
  const iphone=rows.find(p=>p.name==="iPhone 17");
  assert.equal(iphone.variants.length,10);
  assert.equal(new Set(iphone.variants.map(v=>v.image)).size,5);
  assert.ok(!isAppleCatalogImage(new URL("https://store.storeimages.cdn-apple.com.evil.example/1/as-images.apple.com/is/test")));
});
