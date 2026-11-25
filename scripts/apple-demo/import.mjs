import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import pg from "pg";

function demoId(name) {
  const hex = createHash("sha256").update("apple-demo-v1/" + name).digest("hex");
  return [hex.slice(0,8), hex.slice(8,12), "4"+hex.slice(13,16), "a"+hex.slice(17,20), hex.slice(20,32)].join("-");
}

export async function importParameters(store) {
  const catalog = JSON.parse(await readFile(new URL("./catalog.json", import.meta.url), "utf8"));
  const products = catalog.products.map(product => {
    const variants = product.variants.map(({options, image, usd}) => {
      const key = JSON.stringify(Object.entries(options).sort(([a],[b]) => a.localeCompare(b,"en")));
      return {id:demoId(product.name + "/" + key), options, image:catalog.images[image], usd};
    });
    const knownPrices = variants.flatMap(v => v.usd === null ? [] : [v.usd]);
    const baseUsd = knownPrices.length ? Math.min(...knownPrices) : null;
    const groups = Object.keys(variants[0].options).map(name => {
      const labels = [...new Set(variants.map(v => v.options[name]))].sort((a,b)=>a.localeCompare(b,"en",{numeric:true}));
      const otherPrices = new Map();
      let affectsPrice = false;
      for (const v of variants) {
        if (v.usd === null) continue;
        const key = JSON.stringify(Object.entries(v.options).filter(([k])=>k!==name).sort());
        if (otherPrices.has(key) && otherPrices.get(key)!==v.usd) affectsPrice = true;
        otherPrices.set(key,v.usd);
      }
      return {name, affectsPrice, values:labels.map(label=>({label,imageUrl:null}))};
    });
    return {id:demoId(product.name), name:product.name, legacy:demoId(product.name+"/variant"), groups,
      variants: variants.map(v=>({...v, delta:baseUsd!==null && v.usd!==null ? (v.usd-baseUsd)*12500 : 0}))};
  });
  return [store,JSON.stringify(products)];
}

export const sql = await readFile(new URL("./import.sql", import.meta.url), "utf8");
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.env.STORE_ID || !process.env.DATABASE_URL) throw new Error("STORE_ID and DATABASE_URL are required");
  const client = new pg.Client({connectionString:process.env.DATABASE_URL});
  await client.connect();
  try {
    console.log((await client.query(sql,await importParameters(process.env.STORE_ID))).rows[0]);
  } finally { await client.end(); }
}
