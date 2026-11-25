import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes,randomUUID,createHash} from "node:crypto";
import pg from "pg";

// Runs against the disposable database used by staff-api.integration.mjs. It can also run alone.
const origin="http://127.0.0.1:3100";
const storeId="00000000-0000-4000-8000-000000000001";

// Rules confirmed by the owner on 2026-11-25:
// 1. cash and instalment sales are both attributed to investors,
// 2. funding covers the full cost exactly,
// 3. only the administrator assigns investors.
// How a cash receipt is split back to investors is NOT confirmed, so nothing may be posted for it.
test("investors are assigned by the admin, in full, to cash and instalment orders; cash receipts post nothing",async()=>{
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
      return {id:account,cookie:"__Host-store_session="+token};
    }
    async function call(path,method="GET",body,auth){
      const res=await fetch(origin+path,{method,headers:{Cookie:auth.cookie,...(body===undefined?{}:{"Content-Type":"application/json",Origin:origin})},
        ...(body===undefined?{}:{body:JSON.stringify(body)})});
      return {status:res.status,data:await res.json()};
    }
    const seller=await session("seller");const admin=await session("admin");
    const a=await session("investor");const b=await session("investor");
    for(const [investor,amount] of [[a,"10000000"],[b,"5000000"]])
      assert.equal((await call("/api/admin/investors","POST",{accountId:investor.id,type:"contribution",amount,key:randomUUID()},admin)).status,201);
    const product=randomUUID();const variant=randomUUID();
    await pool.query("INSERT INTO products(id,store_id,name,category,published) VALUES($1,$2,'Funding rules fixture','Funding',false)",[product,storeId]);
    await pool.query("INSERT INTO variants(id,store_id,product_id,sku,color,price_uzs,quantity) VALUES($1,$2,$3,$4,'Oq',11000000,5)",[variant,storeId,product,"FUND-"+variant.slice(0,8)]);
    const newOrder=async()=>{const o=await call("/api/admin/orders","POST",{variantId:variant,quantity:1,requestKey:randomUUID()},seller);assert.equal(o.status,201);return "/api/admin/orders/"+o.data.id;};
    const date=(await pool.query("SELECT ((now() AT TIME ZONE 'Asia/Tashkent')::date)::text AS d")).rows[0].d;
    const full={allocations:[{accountId:a.id,amount:"6000000"},{accountId:b.id,amount:"4000000"}]};

    // --- Cash order: the cost is recorded with the terms, then investors can be assigned. ---
    const cash=await newOrder();
    assert.equal((await call(cash+"/payments","POST",{action:"terms",total:"11000000",type:"cash",initial:"0",cost:"0"},seller)).status,400);
    assert.equal((await call(cash+"/payments","POST",{action:"terms",total:"11000000",type:"cash",initial:"0",cost:"abc"},seller)).status,400);
    // Without a cost a cash order still saves, but there is nothing to fund against.
    assert.equal((await call(cash+"/payments","POST",{action:"terms",total:"11000000",type:"cash",initial:"0"},seller)).status,201);
    assert.equal((await call(cash+"/funding","GET",undefined,admin)).data.principal,null);
    assert.equal((await call(cash+"/funding","PUT",full,admin)).status,409);
    assert.equal((await call(cash+"/payments","POST",{action:"terms",total:"11000000",type:"cash",initial:"0",cost:"10000000"},seller)).status,201);
    const terms=(await call(cash+"/payments","GET",undefined,seller)).data.terms;
    assert.deepEqual([terms.payment_type,terms.agreed_total_uzs,terms.cost_uzs,terms.term_months],["cash","11000000","10000000",null]);
    assert.equal((await call(cash+"/funding","GET",undefined,admin)).data.principal,"10000000");

    // Rule 3: sellers cannot assign investors; they can still read. Rule 2: only the exact full cost is accepted.
    assert.equal((await call(cash+"/funding","PUT",full,seller)).status,403);
    assert.equal((await call(cash+"/funding","PUT",full,a)).status,403);
    assert.equal((await call(cash+"/funding","PUT",{allocations:[{accountId:a.id,amount:"6000000"}]},admin)).status,400);
    assert.equal((await call(cash+"/funding","PUT",{allocations:[{accountId:a.id,amount:"6000000"},{accountId:b.id,amount:"4000001"}]},admin)).status,400);
    assert.equal((await call(cash+"/funding","PUT",{allocations:[{accountId:a.id,amount:"4000000"},{accountId:b.id,amount:"6000000"}]},admin)).status,409); // B has only 5 000 000
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM order_funding_allocations WHERE order_id=$1",[cash.split("/").pop()])).rows[0].n,0);
    assert.equal((await call(cash+"/funding","PUT",full,admin)).status,200);
    const seenBySeller=await call(cash+"/funding","GET",undefined,seller);
    assert.equal(seenBySeller.status,200);assert.equal(seenBySeller.data.can_assign,false);assert.equal(seenBySeller.data.allocations.length,2);
    assert.equal((await call(cash+"/funding","GET",undefined,admin)).data.can_assign,true);
    // An empty list clears the allocation (needed before terms can change); then it is saved again in full.
    assert.equal((await call(cash+"/payments","POST",{action:"terms",total:"11500000",type:"cash",initial:"0",cost:"10000000"},seller)).status,409);
    assert.equal((await call(cash+"/funding","PUT",{allocations:[]},admin)).status,200);
    assert.equal((await call(cash+"/funding","GET",undefined,admin)).data.allocations.length,0);
    assert.equal((await call(cash+"/funding","PUT",full,admin)).status,200);

    // The cash sale is paid and confirmed. Nothing is posted to investor ledgers: that rule is not confirmed yet.
    const ledger=async()=>(await pool.query(`SELECT (SELECT count(*) FROM investor_initial_returns WHERE store_id=$1)::int AS initial_returns,
      (SELECT count(*) FROM investor_monthly_allocations WHERE store_id=$1)::int AS monthly,
      (SELECT count(*) FROM investor_capital_events WHERE store_id=$1)::int AS events`,[storeId])).rows[0];
    const before=await ledger();
    const paid=await call(cash+"/payments","POST",{action:"receipt",amount:"11000000",method:"cash",date,key:randomUUID()},seller);
    assert.equal(paid.status,201);
    const detail=await call(cash,"GET",undefined,seller);
    assert.equal((await call(cash+"/sale","POST",{revision:detail.data.order.revision},seller)).status,200);
    assert.deepEqual(await ledger(),before);
    const returns=await call(cash+"/capital-returns","GET",undefined,admin);
    assert.deepEqual(returns.data.receipts,[]);
    const receiptId=(await call(cash+"/payments","GET",undefined,seller)).data.receipts[0].id;
    assert.equal((await call(cash+"/capital-returns","POST",{receiptId,entries:[{accountId:a.id,amount:"6000000"},{accountId:b.id,amount:"5000000"}]},admin)).status,404);
    assert.deepEqual(await ledger(),before);
    // The assigned capital stays outstanding and reduces what each investor has free.
    const balances=(await pool.query("SELECT investor_account_id,amount_uzs::text,returned_uzs::text,outstanding_uzs::text FROM investor_funding_balances WHERE store_id=$1 AND order_id=$2 ORDER BY amount_uzs DESC",[storeId,cash.split("/").pop()])).rows;
    assert.deepEqual(balances.map(r=>[r.amount_uzs,r.returned_uzs,r.outstanding_uzs]),[["6000000","0","6000000"],["4000000","0","4000000"]]);
    const listed=(await call("/api/admin/investors","GET",undefined,admin)).data.items;
    assert.equal(listed.find(i=>i.account_id===a.id).available,"4000000");
    assert.equal(listed.find(i=>i.account_id===b.id).available,"1000000");
    // After the sale the allocation is locked, for the admin too.
    assert.equal((await call(cash+"/funding","PUT",{allocations:[]},admin)).status,409);

    // --- Instalment order: the same two rules. Cost 5 000 000, A has 4 000 000 free and B 1 000 000. ---
    const instalment=await newOrder();
    assert.equal((await call(instalment+"/payments","POST",{action:"terms",cost:"5000000",type:"installment",initial:"1500000",months:3},seller)).status,201);
    const exact={allocations:[{accountId:a.id,amount:"4000000"},{accountId:b.id,amount:"1000000"}]};
    assert.equal((await call(instalment+"/funding","PUT",exact,seller)).status,403);
    assert.equal((await call(instalment+"/funding","PUT",{allocations:[{accountId:a.id,amount:"4000000"}]},admin)).status,400);
    assert.equal((await call(instalment+"/funding","PUT",exact,admin)).status,200);
    assert.equal((await call(instalment+"/funding","GET",undefined,seller)).data.allocations.length,2);
  }finally{await pool.end();}
});
