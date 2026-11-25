import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes,randomUUID,createHash} from "node:crypto";
import pg from "pg";

// Runs against the disposable database used by staff-api.integration.mjs. It can also run alone.
const origin="http://127.0.0.1:3100";
const storeId="00000000-0000-4000-8000-000000000001";

test("staff see the contact of a website request and link a customer from it in one step",async()=>{
  assert.equal(process.env.COMMERCE_TEST_MODE,"1");
  const url=new URL(process.env.DATABASE_URL);
  assert.equal(url.hostname,"127.0.0.1");assert.equal(url.pathname,"/commerce_test");
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  try{
    await pool.query("INSERT INTO stores(id,name) VALUES($1,'Isolated test store') ON CONFLICT DO NOTHING",[storeId]);
    async function session(role){
      const account=randomUUID();const token=randomBytes(32).toString("base64url");
      await pool.query("INSERT INTO accounts(id) VALUES($1)",[account]);
      await pool.query("INSERT INTO memberships(store_id,account_id,role) VALUES($1,$2,$3)",[storeId,account,role]);
      await pool.query("INSERT INTO sessions(token_hash,account_id,password_store_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
        [createHash("sha256").update(token).digest("hex"),account,role==="admin"?storeId:null]);
      return "__Host-store_session="+token;
    }
    async function call(path,method="GET",body,cookie,extra={}){
      const res=await fetch(origin+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{"Content-Type":"application/json",Origin:origin}),...extra},
        ...(body===undefined?{}:{body:JSON.stringify(body)})});
      return {status:res.status,data:await res.json(),cache:res.headers.get("cache-control")};
    }
    const seller=await session("seller");const admin=await session("admin");const investor=await session("investor");
    const product=randomUUID();const first=randomUUID();const second=randomUUID();
    await pool.query("INSERT INTO products(id,store_id,name,category,published) VALUES($1,$2,'Website fixture','Website',true)",[product,storeId]);
    await pool.query("INSERT INTO variants(id,store_id,product_id,sku,color,price_uzs,quantity) VALUES($1,$3,$4,$5,'Oq',5000,5),($2,$3,$4,$6,'Qora',6000,5)",
      [first,second,storeId,product,"WEB-"+first.slice(0,8),"WEB-"+second.slice(0,8)]);
    const digits=String(Math.floor(Math.random()*1e9)).padStart(9,"0");
    const phone="+998"+digits;
    const sent=await call("/api/checkout","POST",{requestKey:randomUUID(),channel:"cart",name:"Sayt Mijozi",phone,comment:"Kechqurun qo‘ng‘iroq qiling",
      lines:[{variantId:first,quantity:1},{variantId:second,quantity:2}]},undefined,{"X-Forwarded-For":"10.9."+Math.floor(Math.random()*250)+"."+Math.floor(Math.random()*250)});
    assert.equal(sent.status,201,JSON.stringify(sent.data));
    const reference=sent.data.reference;
    // Both orders are written in one transaction, so tell them apart by quantity: [the single item, the pair].
    const orders=(await pool.query("SELECT o.id FROM orders o JOIN website_checkouts w ON w.id=o.website_checkout_id JOIN order_items i ON i.order_id=o.id WHERE w.reference=$1 ORDER BY i.quantity",[reference])).rows.map(r=>r.id);
    assert.equal(orders.length,2);

    // The inbox carries the reference, so orders of one request can be recognised.
    const inbox=await call("/api/admin/orders","GET",undefined,seller);
    assert.equal(inbox.data.items.filter(o=>o.website_reference===reference).length,2);
    assert.equal(inbox.data.items.find(o=>o.id===orders[0]).source,"website");

    // Contact details: staff roles only, never cached.
    const path="/api/admin/orders/"+orders[0]+"/website";
    assert.equal((await call(path)).status,403);
    assert.equal((await call(path,"GET",undefined,investor)).status,403);
    const seen=await call(path,"GET",undefined,seller);
    assert.equal(seen.status,200);
    assert.match(seen.cache,/no-store/);
    assert.deepEqual([seen.data.checkout.reference,seen.data.checkout.channel,seen.data.checkout.name,seen.data.checkout.phone,seen.data.checkout.comment],[reference,"cart","Sayt Mijozi",phone,"Kechqurun qo‘ng‘iroq qiling"]);
    assert.deepEqual(seen.data.siblings.map(s=>s.id),[orders[1]]);
    assert.equal(seen.data.siblings[0].quantity,2);
    assert.equal(seen.data.existing_customer,null);assert.equal(seen.data.customer_linked,false);
    assert.equal((await call(path,"GET",undefined,admin)).status,200);

    // An order that did not come from the website has no contact block and cannot use the shortcut.
    const manual=await call("/api/admin/orders","POST",{variantId:first,quantity:1,requestKey:randomUUID()},seller);
    assert.equal(manual.status,201);
    assert.deepEqual((await call("/api/admin/orders/"+manual.data.id+"/website","GET",undefined,seller)).data,{checkout:null});
    assert.equal((await call("/api/admin/orders/"+manual.data.id+"/website","POST",{action:"linkCustomer"},seller)).status,404);

    // One press creates the customer from the contact and links it; nothing else changes.
    const before=(await pool.query("SELECT (SELECT count(*) FROM customers WHERE store_id=$1)::int AS customers,(SELECT count(*) FROM stock_movements WHERE store_id=$1)::int AS stock,(SELECT count(*) FROM order_manual_receipts WHERE store_id=$1)::int AS receipts",[storeId])).rows[0];
    assert.equal((await call(path,"POST",{action:"linkCustomer"},investor)).status,403);
    assert.equal((await call(path,"POST",{action:"linkCustomer"},seller,{Origin:"https://invalid.example"})).status,403);
    assert.equal((await call(path,"POST",{action:"other"},seller)).status,400);
    const linked=await call(path,"POST",{action:"linkCustomer"},seller);
    assert.equal(linked.status,201);
    assert.equal(linked.data.created,true);assert.equal(linked.data.customer.name,"Sayt Mijozi");assert.equal(linked.data.customer.has_passport,false);
    assert.notEqual(linked.data.customer.phone_masked,phone);
    assert.equal((await call(path,"POST",{action:"linkCustomer"},seller)).status,409);
    const attached=await call("/api/admin/orders/"+orders[0]+"/customer","GET",undefined,seller);
    assert.equal(attached.data.customer.id,linked.data.customer.id);
    const stored=(await pool.query("SELECT name_cipher,phone_cipher FROM customers WHERE id=$1",[linked.data.customer.id])).rows[0];
    assert.equal(JSON.stringify(stored).includes(digits),false);assert.equal(JSON.stringify(stored).includes("Sayt Mijozi"),false);

    // The second order of the same request links the same customer instead of creating another.
    const siblingPath="/api/admin/orders/"+orders[1]+"/website";
    assert.equal((await call(siblingPath,"GET",undefined,seller)).data.existing_customer.id,linked.data.customer.id);
    const again=await call(siblingPath,"POST",{action:"linkCustomer"},admin);
    assert.equal(again.status,200);assert.equal(again.data.created,false);assert.equal(again.data.customer.id,linked.data.customer.id);
    const after=(await pool.query("SELECT (SELECT count(*) FROM customers WHERE store_id=$1)::int AS customers,(SELECT count(*) FROM stock_movements WHERE store_id=$1)::int AS stock,(SELECT count(*) FROM order_manual_receipts WHERE store_id=$1)::int AS receipts",[storeId])).rows[0];
    assert.deepEqual(after,{customers:before.customers+1,stock:before.stock,receipts:before.receipts});

    // The passport taken over the phone can be stored while creating the record; it is validated and encrypted.
    const fourth=await call("/api/checkout","POST",{requestKey:randomUUID(),channel:"cart",name:"Pasportli Mijoz",phone:"+998"+String(Math.floor(Math.random()*1e9)).padStart(9,"0"),lines:[{variantId:first,quantity:1}]},undefined,{"X-Forwarded-For":"10.7."+Math.floor(Math.random()*250)+"."+Math.floor(Math.random()*250)});
    assert.equal(fourth.status,201,JSON.stringify(fourth.data));
    const fourthId=(await pool.query("SELECT o.id FROM orders o JOIN website_checkouts w ON w.id=o.website_checkout_id WHERE w.reference=$1",[fourth.data.reference])).rows[0].id;
    assert.equal((await call("/api/admin/orders/"+fourthId+"/website","POST",{action:"linkCustomer",passport:"ab 1"},seller)).status,400);
    const withPassport=await call("/api/admin/orders/"+fourthId+"/website","POST",{action:"linkCustomer",passport:"ab1234567"},seller);
    assert.equal(withPassport.status,201);assert.equal(withPassport.data.customer.has_passport,true);
    assert.equal(JSON.stringify(withPassport.data).toUpperCase().includes("AB1234567"),false);
    assert.equal(String((await pool.query("SELECT passport_cipher FROM customers WHERE id=$1",[withPassport.data.customer.id])).rows[0].passport_cipher).includes("AB1234567"),false);

    // A cancelled request cannot be given a customer.
    const third=await call("/api/checkout","POST",{requestKey:randomUUID(),channel:"one_click",name:"Boshqa Mijoz",phone:"+998"+String(Math.floor(Math.random()*1e9)).padStart(9,"0"),lines:[{variantId:first,quantity:1}]},undefined,{"X-Forwarded-For":"10.8."+Math.floor(Math.random()*250)+"."+Math.floor(Math.random()*250)});
    assert.equal(third.status,201,JSON.stringify(third.data));
    const cancelledId=(await pool.query("SELECT o.id,o.revision FROM orders o JOIN website_checkouts w ON w.id=o.website_checkout_id WHERE w.reference=$1",[third.data.reference])).rows[0];
    assert.equal((await call("/api/admin/orders/"+cancelledId.id,"PATCH",{revision:cancelledId.revision,status:"cancelled"},seller)).status,200);
    assert.equal((await call("/api/admin/orders/"+cancelledId.id+"/website","POST",{action:"linkCustomer"},seller)).status,409);
    assert.equal((await call("/api/admin/orders/"+cancelledId.id+"/website","GET",undefined,seller)).data.checkout.channel,"one_click");
  }finally{await pool.end();}
});
