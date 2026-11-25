import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes,randomUUID,createHash} from "node:crypto";
import pg from "pg";

// Runs against the disposable database used by staff-api.integration.mjs. It can also run alone.
// Test policy: suggested initial 25%, markup 4% a month.
const origin="http://127.0.0.1:3100";
const storeId="00000000-0000-4000-8000-000000000001";

test("an instalment may be agreed with any initial payment from zero up to less than the cost",async()=>{
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
    const date=(await pool.query("SELECT ((now() AT TIME ZONE 'Asia/Tashkent')::date)::text AS d")).rows[0].d;
    async function order(){
      const product=randomUUID();const variant=randomUUID();
      await pool.query("INSERT INTO products(id,store_id,name,category,published) VALUES($1,$2,'Optional initial fixture','Allocation',false)",[product,storeId]);
      await pool.query("INSERT INTO variants(id,store_id,product_id,sku,color,price_uzs,quantity) VALUES($1,$2,$3,$4,'Oq',1120,1)",[variant,storeId,product,"OPT-"+variant.slice(0,8)]);
      const created=await call("/api/admin/orders","POST",{variantId:variant,quantity:1,requestKey:randomUUID()},seller);
      assert.equal(created.status,201);
      return {id:created.data.id,path:"/api/admin/orders/"+created.data.id};
    }
    async function customer(o){
      const c=await call("/api/admin/customers","POST",
        {action:"create",name:"Optional Initial Fixture",phone:"+1202559"+String(Math.floor(Math.random()*9000)+1000),passport:"FIXTURE"+String(Math.floor(Math.random()*90)+10)},seller);
      assert.equal(c.status,201);
      assert.equal((await call(o.path+"/customer","PUT",{customerId:c.data.customer.id},seller)).status,200);
    }
    const terms=(o,initial,cost="1000")=>call(o.path+"/payments","POST",{action:"terms",type:"installment",cost,initial,months:3},seller);
    const saved=async o=>(await call(o.path+"/payments","GET",undefined,seller)).data.terms;
    const activate=o=>call(o.path+"/installments","POST",{action:"activate",months:3,firstDate:"2027-01-31"},seller);

    // 1. No initial payment: the whole cost of 1000 is financed. Markup 1000 × 4% × 3 = 120, total 1120.
    {
      const o=await order();
      assert.equal((await terms(o,"0")).status,201);
      const t=await saved(o);
      assert.deepEqual([t.initial_due_uzs,t.financed_principal_uzs,t.markup_uzs,t.agreed_total_uzs,t.minimum_initial_bps],["0","1000","120","1120",2500]);
      // There is no initial receipt to record.
      const none=await call(o.path+"/payments","POST",{action:"receipt",amount:"100",method:"cash",date,key:randomUUID()},seller);
      assert.equal(none.status,409);assert.match(none.data.error,/boshlang‘ich to‘lov yo‘q/);
      // The schedule is activated directly and carries the whole 1120.
      await customer(o);
      assert.equal((await activate(o)).status,201);
      const schedulePath=o.path+"/installments";
      const rows=(await call(schedulePath,"GET",undefined,seller)).data.schedule;
      assert.deepEqual(rows.map(r=>r.amount_uzs),["374","373","373"]);
      const a=await session("investor");const b=await session("investor");
      for(const [investor,amount] of [[a,"600"],[b,"400"]])
        assert.equal((await call("/api/admin/investors","POST",{accountId:investor.id,type:"contribution",amount,key:randomUUID()},admin)).status,201);
      assert.equal((await call(o.path+"/funding","PUT",{allocations:[{accountId:a.id,amount:"600"},{accountId:b.id,amount:"400"}]},admin)).status,200);
      const revision=(await call(o.path,"GET",undefined,seller)).data.order.revision;
      assert.equal((await call(o.path+"/sale","POST",{revision},seller)).status,200);
      // No initial receipt, so there is no capital return step: monthly payments post straight away.
      assert.deepEqual((await call(o.path+"/capital-returns","GET",undefined,admin)).data.receipts,[]);
      const pay=row=>call(schedulePath,"POST",{action:"receipt",scheduleId:row.id,amount:row.amount_uzs,date,method:"cash",key:randomUUID()},seller);
      assert.equal((await pay(rows[0])).status,201);
      // 374 of 1120: round(374 × 1000 / 1120) = 334 principal, 40 profit.
      const firstSplit=(await pool.query("SELECT sum(principal_uzs)::text AS principal,sum(profit_uzs)::text AS profit FROM investor_monthly_allocations WHERE store_id=$1 AND order_id=$2",[storeId,o.id])).rows[0];
      assert.deepEqual(firstSplit,{principal:"334",profit:"40"});
      assert.equal((await pay(rows[1])).status,201);assert.equal((await pay(rows[2])).status,201);
      assert.equal((await call(schedulePath,"GET",undefined,seller)).data.contract.status,"settled");
      for(const [investor,capital,profit] of [[a,"600","72"],[b,"400","48"]]){
        const own=(await call("/api/investor/summary","GET",undefined,investor)).data;
        assert.equal(own.outstanding_uzs,"0");assert.equal(own.returned_uzs,capital);assert.equal(own.received_profit_uzs,profit);
      }
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM investor_initial_returns WHERE store_id=$1 AND order_id=$2",[storeId,o.id])).rows[0].n,0);
    }

    // 2. An initial below the suggested 25% (here 100 of 1000) is accepted and still has to be received first.
    {
      const o=await order();
      assert.equal((await terms(o,"100")).status,201);
      const t=await saved(o);
      assert.deepEqual([t.initial_due_uzs,t.financed_principal_uzs,t.markup_uzs,t.agreed_total_uzs],["100","900","108","1108"]);
      await customer(o);
      const early=await activate(o);
      assert.equal(early.status,409);assert.match(early.data.error,/boshlang‘ich to‘lov to‘liq qayd etilishi kerak/);
      assert.equal((await call(o.path+"/payments","POST",{action:"receipt",amount:"101",method:"cash",date,key:randomUUID()},seller)).status,409);
      assert.equal((await call(o.path+"/payments","POST",{action:"receipt",amount:"100",method:"cash",date,key:randomUUID()},seller)).status,201);
      assert.equal((await activate(o)).status,201);
      assert.deepEqual((await call(o.path+"/installments","GET",undefined,seller)).data.schedule.map(r=>r.amount_uzs),["336","336","336"]);
    }

    // 3. Unchanged: the usual initial prices as before, and the cost or more as initial is refused.
    {
      const o=await order();
      for(const initial of ["1000","1001","-1","abc"])assert.equal((await terms(o,initial)).status,400,"initial "+initial);
      assert.equal(await saved(o),null);
      assert.equal((await terms(o,"300")).status,201);
      const t=await saved(o);
      assert.deepEqual([t.initial_due_uzs,t.financed_principal_uzs,t.markup_uzs,t.agreed_total_uzs],["300","700","84","1084"]);
      // Terms can still be changed before any payment, also to no initial at all.
      assert.equal((await terms(o,"0")).status,201);
      assert.equal((await saved(o)).agreed_total_uzs,"1120");
    }
  }finally{await pool.end();}
});
