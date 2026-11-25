import assert from "node:assert/strict";
import {createHash,randomBytes,randomUUID} from "node:crypto";
import test from "node:test";
import pg from "pg";

// Runs against the local disposable database only, like staff-api.integration.mjs.
const origin="http://127.0.0.1:3100";
test("website checkout creates encrypted, deduplicated purchase requests and nothing else", async () => {
 assert.equal(process.env.COMMERCE_TEST_MODE,"1");
 assert.equal(process.env.APP_ORIGIN,origin);
 assert.equal(new URL(process.env.DATABASE_URL).hostname,"127.0.0.1");
 assert.equal(new URL(process.env.DATABASE_URL).pathname,"/commerce_test");
 const storeId=process.env.STORE_ID;
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
 try{
  const product=randomUUID(),phone=randomUUID(),inactive=randomUUID(),hidden=randomUUID();
  await pool.query("INSERT INTO products(id,store_id,name,category,published) VALUES($1,$2,'Checkout phone','Checkout',true),($3,$2,'Hidden product','Checkout',false)",[product,storeId,hidden]);
  await pool.query(`INSERT INTO variants(id,store_id,product_id,sku,color,price_uzs,quantity,active) VALUES
    ($1,$2,$3,'CHK-1','Oq',5000,2,true),($4,$2,$3,'CHK-2','Qora',7000,0,false),($5,$2,$6,'CHK-3','Oq',9000,1,true)`,[phone,storeId,product,inactive,randomUUID(),hidden]);
  const visibleSecond=(await pool.query("INSERT INTO variants(store_id,product_id,sku,color,price_uzs,quantity) VALUES($1,$2,'CHK-4','Ko‘k',6000,0) RETURNING id",[storeId,product])).rows[0].id;
  const hiddenVariant=(await pool.query("SELECT id FROM variants WHERE sku='CHK-3' AND store_id=$1",[storeId])).rows[0].id;

  let ip=0;
  const post=async(path,body,{headers={},address=`10.0.0.${++ip}`}={})=>{
   const res=await fetch(origin+path,{method:"POST",headers:{Origin:origin,"Content-Type":"application/json","X-Forwarded-For":address,...headers},body:JSON.stringify(body)});
   return {status:res.status,text:await res.text()};
  };
  const json=r=>JSON.parse(r.text);
  const finance=async()=>(await pool.query(`SELECT
     (SELECT count(*) FROM stock_movements WHERE store_id=$1)::int AS stock,
     (SELECT count(*) FROM order_funding_allocations WHERE store_id=$1)::int AS funding,
     (SELECT sum(quantity) FROM variants WHERE store_id=$1)::int AS units`,[storeId])).rows[0];
  const before=await finance();
  const contact={name:"Test Mijoz",phone:"+998 90 123 45 67",comment:"Kechqurun qo‘ng‘iroq qiling"};
  const cart=(lines,extra={})=>({requestKey:randomUUID(),channel:"cart",lines,...contact,...extra});

  // The cart quote re-reads prices from the database.
  const quote=json(await post("/api/cart",{lines:[{variantId:phone,quantity:2},{variantId:inactive,quantity:1}]}));
  assert.deepEqual(quote.lines.map(l=>[l.unitPrice,l.available]),[["5000",true],["7000",false]]);

  // Success: one order per line, one checkout, prices from the database.
  const body=cart([{variantId:phone,quantity:2,expectedPrice:"5000"},{variantId:visibleSecond,quantity:1}]);
  const created=await post("/api/checkout",body,{address:"10.1.0.1"});
  assert.equal(created.status,201,created.text);
  const result=json(created);
  assert.match(result.reference,/^MT-[0-9A-HJ-NP-Z]{8}$/);
  assert.equal(result.orders,2);
  assert.equal(result.total,String(5000*2+6000));
  assert.ok(!created.text.includes("901234567")&&!created.text.includes("Mijoz"),"response must not echo contact details");
  const stored=(await pool.query(`SELECT c.*,array_agg(o.source) AS sources,array_agg(o.created_by) AS creators FROM website_checkouts c
    JOIN orders o ON o.website_checkout_id=c.id WHERE c.reference=$1 GROUP BY c.id`,[result.reference])).rows[0];
  assert.deepEqual(stored.sources,["website","website"]);
  assert.deepEqual(stored.creators,[null,null]);
  for(const field of ["name_cipher","phone_cipher","comment_cipher"])assert.ok(stored[field].startsWith("v1.")&&!stored[field].includes("998"));
  const items=(await pool.query("SELECT i.unit_price_uzs::text AS price,i.quantity FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.website_checkout_id=$1 ORDER BY price",[stored.id])).rows;
  assert.deepEqual(items,[{price:"5000",quantity:2},{price:"6000",quantity:1}]);

  // Retry with the same key returns the same reference and creates nothing new.
  const retried=await post("/api/checkout",body,{address:"10.1.0.2"});
  assert.equal(retried.status,200);
  assert.equal(json(retried).reference,result.reference);
  assert.equal(json(retried).repeated,true);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM orders WHERE website_checkout_id=$1",[stored.id])).rows[0].n,2);
  // The same key with different contents is refused.
  assert.equal((await post("/api/checkout",{...body,lines:[{variantId:phone,quantity:1}]})).status,409);

  // Tampered price, inactive and unpublished variants are refused and write no orders.
  const checkouts=async()=>(await pool.query("SELECT count(*)::int AS n FROM website_checkouts WHERE store_id=$1",[storeId])).rows[0].n;
  const count=await checkouts();
  const tampered=await post("/api/checkout",cart([{variantId:phone,quantity:1,expectedPrice:"1"}]));
  assert.equal(tampered.status,409);assert.equal(json(tampered).code,"price_changed");
  assert.equal(json(tampered).lines[0].unitPrice,"5000");
  assert.equal(json(await post("/api/checkout",cart([{variantId:inactive,quantity:1}]))).code,"unavailable");
  assert.equal(json(await post("/api/checkout",cart([{variantId:hiddenVariant,quantity:1}]))).code,"unavailable");
  assert.equal(await checkouts(),count);

  // Validation, origin and honeypot.
  assert.equal((await post("/api/checkout",cart([{variantId:phone,quantity:1}],{phone:"+7 999 123 45 67"}))).status,400);
  assert.equal((await post("/api/checkout",cart([{variantId:phone,quantity:0}]))).status,400);
  assert.equal((await post("/api/checkout",cart([{variantId:phone,quantity:1},{variantId:phone,quantity:1}]))).status,400);
  assert.equal((await post("/api/checkout",cart([{variantId:phone,quantity:1}],{website:"http://spam.example"}))).status,400);
  assert.equal((await post("/api/checkout",cart([{variantId:phone,quantity:1}]),{headers:{Origin:"https://evil.example"}})).status,403);

  // One click: a single line; a double press creates one request.
  const oneClick={...cart([{variantId:phone,quantity:1,expectedPrice:"5000"}]),channel:"one_click",phone:"+998901112233"};
  const [first,second]=[await post("/api/checkout",oneClick),await post("/api/checkout",oneClick)];
  assert.equal(first.status,201);assert.equal(second.status,200);
  assert.equal(json(first).reference,json(second).reference);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM website_checkouts WHERE reference=$1 AND channel='one_click'",[json(first).reference])).rows[0].n,1);
  assert.equal((await post("/api/checkout",{...oneClick,requestKey:randomUUID(),lines:[{variantId:phone,quantity:1},{variantId:visibleSecond,quantity:1}]})).status,400);

  // Rate limits: per phone across addresses, and per address across phones.
  const limited={...contact,phone:"+998935550000"};
  const statuses=[];
  for(let i=0;i<6;i++)statuses.push((await post("/api/checkout",{...cart([{variantId:phone,quantity:1}]),...limited})).status);
  assert.deepEqual(statuses,[201,201,201,201,201,429]);
  const perAddress=[];
  for(let i=0;i<11;i++)perAddress.push((await post("/api/checkout",cart([{variantId:phone,quantity:1}],{phone:`+99894${String(1000000+i)}`}),{address:"10.9.9.9"})).status);
  assert.equal(perAddress.filter(s=>s===201).length,10);
  assert.equal(perAddress.at(-1),429);
  const buckets=(await pool.query("SELECT bucket FROM website_checkout_attempts WHERE store_id=$1",[storeId])).rows;
  assert.ok(buckets.every(b=>/^(ip|phone):[0-9a-f]{64}$/.test(b.bucket)));

  // Requests never move stock or touch finance tables.
  assert.deepEqual(await finance(),before);

  // A customer session can never act as staff, seller, investor or admin, even for an account that is a seller.
  const seller=(await pool.query("INSERT INTO accounts DEFAULT VALUES RETURNING id")).rows[0].id;
  await pool.query("INSERT INTO memberships(store_id,account_id,role) VALUES($1,$2,'seller')",[storeId,seller]);
  const token=randomBytes(32).toString("base64url");
  await pool.query("INSERT INTO customer_sessions(token_hash,store_id,account_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[createHash("sha256").update(token).digest("hex"),storeId,seller]);
  for(const cookie of ["__Host-store_customer="+token,"__Host-store_session="+token]){
   for(const path of ["/api/admin/orders","/api/admin/catalog","/api/investor/summary"]){
    const res=await fetch(origin+path,{headers:{Cookie:cookie}});
    assert.equal(res.status,403,path+" with "+cookie.split("=")[0]);
   }
  }
 }finally{await pool.end();}
});
