// Converts catalog prices from so'm to whole US dollars, once.
//
//   DATABASE_URL=... STORE_ID=... node scripts/convert-prices-to-usd.mjs --rate=12500            dry run (default)
//   DATABASE_URL=... STORE_ID=... node scripts/convert-prices-to-usd.mjs --rate=12500 --apply    writes
//
// --rate is so'm per one US dollar. Only variants.price_uzs is converted; the `_uzs` suffix is
// legacy naming and after this run the values are whole dollars (see lib/money.ts).
//
// Rounding rule (retail prices): dollars = price / rate. A result that is already whole dollars is
// kept as it is ($25.00 -> $25). Otherwise, under $100 it is rounded to the nearest dollar (never
// below $1): $24.80 -> $25. From $100 up it is rounded to the nearest $10 and then $1 is taken off,
// so prices end in 9 and move by at most $6: $803.40 -> $799, $1,247.20 -> $1,249.
//
// Safety:
// - Dry run unless --apply. Prints a before and after table either way.
// - Runs once per store: --apply records an audit event (catalog_prices_converted_to_usd) and refuses
//   to run again if one exists. Each row is updated only if it still holds the price that was read.
// - Refuses when prices already look like dollars (the cheapest active price is under 10,000).
// - Lists every other column ending in _uzs that holds amounts for the store, so nothing stays
//   mixed. It never changes those: orders, receipts and capital events need a decision first.
import pg from "pg";
import {pathToFileURL} from "node:url";

export const MARKER="catalog_prices_converted_to_usd";

/** So'm to a retail whole-dollar price, as described above. */
export function retailDollars(soum,rate){
  const usd=Number(soum)/rate;
  if(!Number.isFinite(usd)||usd<=0)throw new Error("Bad price "+soum);
  if(Math.abs(usd-Math.round(usd))<1e-9)return Math.round(usd);
  if(usd<99.5)return Math.max(1,Math.round(usd));
  return Math.max(99,Math.round(usd/10)*10-1);
}

export function parseRate(arg){
  const raw=arg?.split("=")[1];
  const rate=Number(raw);
  if(!raw||!/^\d+(\.\d+)?$/.test(raw)||!(rate>=1000&&rate<=100000))throw new Error("Pass --rate=<so'm per 1 USD>, a number between 1,000 and 100,000");
  return rate;
}

const fmt=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,",");

// Option groups carry labels, images and an affectsPrice flag, never amounts. Report any number found anyway.
function priceLikeNumbers(groups){
  const found=[];
  const walk=(v,path)=>{
    if(Array.isArray(v))v.forEach((x,i)=>walk(x,path+"["+i+"]"));
    else if(v&&typeof v==="object")for(const [k,x] of Object.entries(v))walk(x,path+"."+k);
    else if(typeof v==="number"||(typeof v==="string"&&/price|delta|surcharge|amount/i.test(path)&&/^\d+$/.test(v)))found.push(path+"="+v);
  };
  walk(groups,"");
  return found;
}

async function main(){
  const args=process.argv.slice(2);
  const rate=parseRate(args.find(a=>a.startsWith("--rate=")));
  const apply=args.includes("--apply");
  const {DATABASE_URL,STORE_ID}=process.env;
  if(!DATABASE_URL||!STORE_ID)throw new Error("Set DATABASE_URL and STORE_ID");
  const host=new URL(DATABASE_URL).host;
  console.log(`${apply?"APPLY":"DRY RUN"} on ${host}, store ${STORE_ID}, rate ${fmt(rate)} so'm = $1\n`);

  const client=new pg.Client({connectionString:DATABASE_URL});
  await client.connect();
  try{
    await client.query("BEGIN");
    await client.query("SELECT id FROM stores WHERE id=$1 FOR UPDATE",[STORE_ID]);
    const done=await client.query("SELECT created_at FROM audit_events WHERE store_id=$1 AND action=$2 LIMIT 1",[STORE_ID,MARKER]);
    if(done.rowCount)throw new Error("Prices were already converted on "+done.rows[0].created_at.toISOString()+". Nothing to do.");

    const rows=(await client.query(`SELECT v.id,v.sku,p.name,v.price_uzs::text AS price,v.active
      FROM variants v JOIN products p ON p.store_id=v.store_id AND p.id=v.product_id
      WHERE v.store_id=$1 ORDER BY p.name,v.price_uzs,v.sku`,[STORE_ID])).rows;
    if(!rows.length)throw new Error("No variants in this store");
    const cheapest=Math.min(...rows.filter(r=>r.active).map(r=>Number(r.price)));
    if(cheapest<10000)throw new Error(`The cheapest active price is ${fmt(cheapest)}, which already looks like dollars. Stopping.`);

    const plan=rows.map(r=>({...r,exact:Number(r.price)/rate,after:retailDollars(r.price,rate)}));
    console.log("Variant prices");
    console.table(plan.map(r=>({product:r.name.slice(0,32),sku:r.sku.slice(0,22),active:r.active,"before (so'm)":fmt(r.price),"exact $":r.exact.toFixed(2),"after $":fmt(r.after)})));

    const groups=(await client.query("SELECT name,option_groups FROM products WHERE store_id=$1",[STORE_ID])).rows
      .map(r=>({name:r.name,numbers:priceLikeNumbers(r.option_groups)})).filter(r=>r.numbers.length);
    console.log(groups.length?"Option groups holding numbers (NOT converted, review by hand):":"Option groups: no price deltas stored, nothing to convert.");
    for(const g of groups)console.log("  "+g.name+": "+g.numbers.join(", "));

    // Every other money column, found from the schema rather than a hand-kept list.
    const columns=(await client.query(`SELECT c.table_name,c.column_name FROM information_schema.columns c
      JOIN information_schema.columns s ON s.table_schema=c.table_schema AND s.table_name=c.table_name AND s.column_name='store_id'
      WHERE c.table_schema='public' AND c.column_name LIKE '%\\_uzs' AND NOT (c.table_name='variants' AND c.column_name='price_uzs')
      ORDER BY c.table_name,c.column_name`)).rows;
    const others=[];
    for(const {table_name:t,column_name:c} of columns){
      const r=(await client.query(`SELECT count(*)::int AS rows,count("${c}")::int AS filled,coalesce(sum("${c}"),0)::text AS total FROM "${t}" WHERE store_id=$1`,[STORE_ID])).rows[0];
      if(r.filled)others.push({table:t,column:c,rows:r.rows,"non-null":r.filled,"sum (so'm, unchanged)":fmt(r.total)});
    }
    console.log(others.length?"\nOther tables holding so'm amounts (NOT converted, need a decision):":"\nNo other table holds amounts for this store.");
    if(others.length)console.table(others);

    if(!apply){await client.query("ROLLBACK");console.log("\nDry run: nothing written. Add --apply to convert the variant prices above.");return;}
    let changed=0;
    for(const r of plan){
      const u=await client.query("UPDATE variants SET price_uzs=$3,revision=revision+1 WHERE store_id=$1 AND id=$2 AND price_uzs=$4",[STORE_ID,r.id,r.after,r.price]);
      if(u.rowCount!==1)throw new Error("Variant "+r.sku+" changed while converting. Nothing written.");
      changed++;
    }
    await client.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,NULL,$2,'store',$1)",[STORE_ID,MARKER]);
    await client.query("COMMIT");
    console.log(`\nConverted ${changed} variant prices to whole US dollars.`);
  }catch(error){await client.query("ROLLBACK").catch(()=>{});throw error;}finally{await client.end();}
}

if(import.meta.url===pathToFileURL(process.argv[1]??"").href)main().catch(e=>{console.error(e.message);process.exit(1);});
