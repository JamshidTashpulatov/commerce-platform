import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes,randomUUID,createHash} from "node:crypto";
import pg from "pg";
const origin="http://127.0.0.1:3100";
const storeId="00000000-0000-4000-8000-000000000001";
test("staff requests, role checks, stock movement and delivery lifecycle",async()=>{
 assert.equal(process.env.COMMERCE_TEST_MODE,"1");
 const url=new URL(process.env.DATABASE_URL);
 assert.equal(url.hostname,"127.0.0.1");assert.equal(url.pathname,"/commerce_test");
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
 try{
  await pool.query("INSERT INTO stores(id,name) VALUES($1,'Isolated test store')",[storeId]);
  async function session(role){
   const account=randomUUID();const token=randomBytes(32).toString("base64url");
   await pool.query("INSERT INTO accounts(id) VALUES($1)",[account]);
   await pool.query("INSERT INTO memberships(store_id,account_id,role) VALUES($1,$2,$3)",[storeId,account,role]);
   await pool.query("INSERT INTO sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[createHash("sha256").update(token).digest("hex"),account]);
   return "__Host-store_session="+token;
  }
  const seller=await session("seller");const investor=await session("investor");
  const product=randomUUID();const variant=randomUUID();
  await pool.query("INSERT INTO products(id,store_id,name,category,published) VALUES($1,$2,'Test phone','Test',true)",[product,storeId]);
  await pool.query("INSERT INTO variants(id,store_id,product_id,sku,color,storage_label,price_uzs,quantity) VALUES($1,$2,$3,'CI-001','Oq','512 GB',1000,3)",[variant,storeId,product]);
  async function call(path,method="GET",body,auth,requestOrigin=origin){
   const res=await fetch(origin+path,{method,headers:{...(auth?{Cookie:auth}:{}),...(body===undefined?{}:{"Content-Type":"application/json",Origin:requestOrigin})},...(body===undefined?{}:{body:JSON.stringify(body)})});
   return {status:res.status,data:await res.json()};
  }
  const stock=async()=>Number((await pool.query("SELECT quantity FROM variants WHERE id=$1",[variant])).rows[0].quantity);
  assert.equal((await call("/api/admin/orders")).status,403);
  assert.equal((await call("/api/admin/orders","GET",undefined,investor)).status,403);
  assert.equal((await call("/api/admin/variants","GET",undefined,seller)).data.items[0].id,variant);
  const body={variantId:variant,quantity:2,requestKey:randomUUID()};
  assert.equal((await call("/api/admin/orders","POST",body,seller,"https://invalid.example")).status,403);
  const created=await call("/api/admin/orders","POST",body,seller);
  assert.equal(created.status,201);const id=created.data.id;const path="/api/admin/orders/"+id;
  assert.equal(await stock(),3);
  const repeated=await call("/api/admin/orders","POST",body,seller);assert.equal(repeated.status,200);assert.equal(repeated.data.id,id);
  assert.equal((await call(path,"GET",undefined,investor)).status,403);
  assert.equal((await call(path,"PUT",{revision:0,fulfillment:"delivered"},seller)).status,409);
  assert.equal((await call(path,"PATCH",{revision:0,status:"in_progress"},seller)).status,200);
  assert.equal((await call(path+"/sale","POST",{revision:0},seller)).status,409);
  assert.equal((await call(path+"/sale","POST",{revision:1},seller)).status,200);
  assert.equal(await stock(),1);
  assert.equal((await call(path+"/sale","POST",{revision:2},seller)).status,409);
  assert.equal(await stock(),1);
  assert.equal((await call(path,"PUT",{revision:2,fulfillment:"delivered"},seller)).status,200);
  const detail=await call(path,"GET",undefined,seller);assert.equal(detail.data.order.fulfillment_status,"delivered");
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM stock_movements WHERE store_id=$1 AND reason='sale'",[storeId])).rows[0].n,1);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_events WHERE store_id=$1 AND entity_id=$2",[storeId,id])).rows[0].n,4);
 }finally{await pool.end();}
});
