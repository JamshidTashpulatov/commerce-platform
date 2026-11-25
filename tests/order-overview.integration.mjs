import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes,randomUUID,createHash} from "node:crypto";
import pg from "pg";

// Runs against the disposable database used by staff-api.integration.mjs. It can also run alone.
const origin="http://127.0.0.1:3100";
const storeId="00000000-0000-4000-8000-000000000001";

test("the order page reads a per-investor table and a history, for staff only",async()=>{
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
    const investors=[];for(let i=0;i<5;i++)investors.push(await session("investor"));
    const date=(await pool.query("SELECT ((now() AT TIME ZONE 'Asia/Tashkent')::date)::text AS d")).rows[0].d;

    // Cost 1250 funded 250 each by five investors, initial 500, six months at 4%: instalments of 155.
    const product=randomUUID();const variant=randomUUID();
    await pool.query("INSERT INTO products(id,store_id,name,category,published) VALUES($1,$2,'Overview fixture','Allocation',false)",[product,storeId]);
    await pool.query("INSERT INTO variants(id,store_id,product_id,sku,color,price_uzs,quantity) VALUES($1,$2,$3,$4,'Oq',1475,1)",[variant,storeId,product,"VIEW-"+variant.slice(0,8)]);
    const order=await call("/api/admin/orders","POST",{variantId:variant,quantity:1,requestKey:randomUUID()},seller);
    assert.equal(order.status,201);
    const path="/api/admin/orders/"+order.data.id;
    const table=async auth=>(await call(path+"/investors","GET",undefined,auth));

    // Before funding the table is empty, and investors never read it.
    const empty=await table(seller);
    assert.equal(empty.status,200);assert.deepEqual(empty.data.investors,[]);assert.equal(empty.data.initial_mismatch,false);
    assert.equal((await table(investors[0])).status,403);
    assert.equal((await call(path+"/history","GET",undefined,investors[0])).status,403);
    assert.equal((await call("/api/admin/orders/"+randomUUID()+"/investors","GET",undefined,admin)).status,404);
    assert.equal((await call("/api/admin/orders/"+randomUUID()+"/history","GET",undefined,admin)).status,404);

    assert.equal((await call(path+"/payments","POST",{action:"terms",type:"installment",cost:"1250",initial:"500",months:6},seller)).status,201);
    assert.equal((await call(path+"/payments","POST",{action:"receipt",amount:"500",method:"cash",date,key:randomUUID()},seller)).status,201);
    const customer=await call("/api/admin/customers","POST",{action:"create",name:"Overview Fixture",phone:"+1202560"+String(Math.floor(Math.random()*9000)+1000),passport:"FIXTURE04"},seller);
    assert.equal((await call(path+"/customer","PUT",{customerId:customer.data.customer.id},seller)).status,200);
    assert.equal((await call(path+"/installments","POST",{action:"activate",months:6,firstDate:"2027-01-31"},seller)).status,201);
    for(const i of investors)assert.equal((await call("/api/admin/investors","POST",{accountId:i.id,type:"contribution",amount:"250",key:randomUUID()},admin)).status,201);
    assert.equal((await call(path+"/funding","PUT",{allocations:investors.map(i=>({accountId:i.id,amount:"250"}))},admin)).status,200);
    const revision=(await call(path,"GET",undefined,seller)).data.order.revision;
    assert.equal((await call(path+"/sale","POST",{revision},seller)).status,200);

    const fundedView=(await table(seller)).data;
    assert.equal(fundedView.fully_funded,true);assert.equal(fundedView.cost,"1250");
    assert.deepEqual(fundedView.investors.map(r=>[r.invested_uzs,r.share_bps,r.initial_returned_uzs,r.outstanding_uzs]),Array(5).fill(["250",2000,"0","250"]));
    assert.deepEqual(fundedView.totals,{invested_uzs:"1250",initial_returned_uzs:"0",monthly_principal_uzs:"0",profit_uzs:"0",outstanding_uzs:"1250"});

    // The stuck-order case: 250 and 250 written to two investors, nothing to the other three.
    // The table says so and shows what each investor should have: 100.
    const receipt=(await call(path+"/capital-returns","GET",undefined,admin)).data.receipts[0].id;
    const [a,b]=investors;
    for(const i of [a,b])await pool.query("INSERT INTO investor_initial_returns(store_id,order_id,receipt_id,investor_account_id,amount_uzs,recorded_by) VALUES($1,$2,$3,$4,250,$5)",[storeId,order.data.id,receipt,i.id,admin.id]);
    const wrong=(await table(admin)).data;
    assert.equal(wrong.initial_mismatch,true);
    const byId=id=>wrong.investors.find(r=>r.account_id===id);
    assert.deepEqual([byId(a.id).initial_returned_uzs,byId(a.id).initial_expected_uzs,byId(a.id).outstanding_uzs],["250","100","0"]);
    assert.deepEqual([byId(investors[4].id).initial_returned_uzs,byId(investors[4].id).initial_expected_uzs,byId(investors[4].id).outstanding_uzs],["0","100","250"]);
    assert.equal(wrong.totals.initial_returned_uzs,"500");assert.equal(wrong.totals.outstanding_uzs,"750");

    // Proportional returns and one monthly payment of 155: 125 principal and 30 profit, 25 and 6 each.
    await pool.query("UPDATE investor_initial_returns SET amount_uzs=100 WHERE store_id=$1 AND order_id=$2",[storeId,order.data.id]);
    for(const i of investors.slice(2))await pool.query("INSERT INTO investor_initial_returns(store_id,order_id,receipt_id,investor_account_id,amount_uzs,recorded_by) VALUES($1,$2,$3,$4,100,$5)",[storeId,order.data.id,receipt,i.id,admin.id]);
    const rows=(await call(path+"/installments","GET",undefined,seller)).data.schedule;
    assert.equal((await call(path+"/installments","POST",{action:"receipt",scheduleId:rows[0].id,amount:"155",date,method:"cash",key:randomUUID()},seller)).status,201);
    const paid=(await table(seller)).data;
    assert.equal(paid.initial_mismatch,false);
    assert.deepEqual(paid.investors.map(r=>[r.initial_returned_uzs,r.initial_expected_uzs,r.monthly_principal_uzs,r.profit_uzs,r.outstanding_uzs]),Array(5).fill(["100",null,"25","6","125"]));
    assert.deepEqual(paid.totals,{invested_uzs:"1250",initial_returned_uzs:"500",monthly_principal_uzs:"125",profit_uzs:"30",outstanding_uzs:"625"});

    // History: newest first, action and role only.
    const history=await call(path+"/history","GET",undefined,seller);
    assert.equal(history.status,200);
    const actions=history.data.events.map(e=>e.action);
    assert.equal(actions[0],"installment_receipt_recorded");assert.equal(actions.at(-1),"request_created");
    for(const expected of ["payment_terms_saved","manual_receipt_recorded","customer_linked","installment_schedule_activated","funding_allocations_saved","sale_confirmed"])assert.ok(actions.includes(expected),expected);
    assert.deepEqual(Object.keys(history.data.events[0]).sort(),["action","actor_role","created_at","id"]);
    assert.equal(history.data.events.find(e=>e.action==="funding_allocations_saved").actor_role,"admin");
  }finally{await pool.end();}
});
