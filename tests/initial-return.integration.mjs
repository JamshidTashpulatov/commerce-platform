import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes,randomUUID,createHash} from "node:crypto";
import pg from "pg";

// Runs against the disposable database used by staff-api.integration.mjs. It can also run alone.
const origin="http://127.0.0.1:3100";
const storeId="00000000-0000-4000-8000-000000000001";

test("the initial payment returns to investors in proportion to funding, computed by the system",async()=>{
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
    const contribute=(investor,amount,type="contribution")=>call("/api/admin/investors","POST",{accountId:investor.id,type,amount,key:randomUUID()},admin);

    // Cost 1250, initial 500, six months at 4% a month: financed 750, markup 180, six instalments of 155.
    // Five investors fund 250 each. `parts` are the initial receipts as the customer paid them.
    async function soldOrder(parts){
      const investors=[];for(let i=0;i<5;i++)investors.push(await session("investor"));
      investors.sort((x,y)=>x.id<y.id?-1:1);
      const product=randomUUID();const variant=randomUUID();
      await pool.query("INSERT INTO products(id,store_id,name,category,published) VALUES($1,$2,'Initial return fixture','Allocation',false)",[product,storeId]);
      await pool.query("INSERT INTO variants(id,store_id,product_id,sku,color,price_uzs,quantity) VALUES($1,$2,$3,$4,'Oq',1475,1)",[variant,storeId,product,"INIT-"+variant.slice(0,8)]);
      const order=await call("/api/admin/orders","POST",{variantId:variant,quantity:1,requestKey:randomUUID()},seller);
      assert.equal(order.status,201);
      const path="/api/admin/orders/"+order.data.id;
      assert.equal((await call(path+"/payments","POST",{action:"terms",type:"installment",cost:"1250",initial:"500",months:6},seller)).status,201);
      for(const amount of parts)assert.equal((await call(path+"/payments","POST",{action:"receipt",amount,method:"cash",date,key:randomUUID()},seller)).status,201);
      const customer=await call("/api/admin/customers","POST",
        {action:"create",name:"Initial Return Fixture",phone:"+1202556"+String(Math.floor(Math.random()*9000)+1000),passport:"FIXTURE"+String(Math.floor(Math.random()*90)+10)},seller);
      assert.equal(customer.status,201);
      assert.equal((await call(path+"/customer","PUT",{customerId:customer.data.customer.id},seller)).status,200);
      assert.equal((await call(path+"/installments","POST",{action:"activate",months:6,firstDate:"2027-01-31"},seller)).status,201);
      for(const investor of investors)assert.equal((await contribute(investor,"250")).status,201);
      assert.equal((await call(path+"/funding","PUT",{allocations:investors.map(i=>({accountId:i.id,amount:"250"}))},admin)).status,200);
      const revision=(await call(path,"GET",undefined,seller)).data.order.revision;
      assert.equal((await call(path+"/sale","POST",{revision},seller)).status,200);
      const rows=(await call(path+"/installments","GET",undefined,seller)).data.schedule;
      assert.deepEqual(rows.map(r=>r.amount_uzs),["155","155","155","155","155","155"]);
      return {id:order.data.id,path,investors,rows};
    }
    const returnsOf=async(order,investors)=>{
      const rows=(await pool.query("SELECT investor_account_id,sum(amount_uzs)::text AS amount FROM investor_initial_returns WHERE store_id=$1 AND order_id=$2 GROUP BY 1",[storeId,order])).rows;
      return investors.map(i=>rows.find(r=>r.investor_account_id===i.id)?.amount??"0");
    };
    const monthly=(o,amount="155")=>call(o.path+"/installments","POST",{action:"receipt",scheduleId:o.rows[0].id,amount,date,method:"cash",key:randomUUID()},seller);

    // 1. The system computes 100 for each of the five investors; a typed split is refused.
    {
      const o=await soldOrder(["500"]);const returns=o.path+"/capital-returns";
      const view=(await call(returns,"GET",undefined,admin)).data;
      assert.equal(view.correction,null);
      assert.deepEqual(view.receipts[0].shares,o.investors.map(i=>({account_id:i.id,amount_uzs:"100"})));
      const receiptId=view.receipts[0].id;
      // The seller sees the same computed shares but cannot confirm them.
      assert.deepEqual((await call(returns,"GET",undefined,seller)).data.receipts[0].shares,view.receipts[0].shares);
      assert.equal((await call(returns,"POST",{receiptId},seller)).status,403);
      // A monthly payment before the return is confirmed tells the seller who must do what.
      const early=await monthly(o);
      assert.equal(early.status,409);assert.match(early.data.error,/hali investorlarga taqsimlanmagan.*Kapital qaytimi/);
      const typed=await call(returns,"POST",{receiptId,entries:[{accountId:o.investors[0].id,amount:"250"},{accountId:o.investors[1].id,amount:"250"}]},admin);
      assert.equal(typed.status,400);assert.match(typed.data.error,/tizim hisoblaydi/);
      assert.deepEqual(await returnsOf(o.id,o.investors),["0","0","0","0","0"]);
      assert.equal((await call(returns,"POST",{receiptId},admin)).status,201);
      assert.deepEqual(await returnsOf(o.id,o.investors),["100","100","100","100","100"]);
      const again=await call(returns,"POST",{receiptId},admin);
      assert.equal(again.status,200);assert.equal(again.data.repeated,true);
      assert.equal((await call(returns,"POST",{receiptId,entries:[{accountId:o.investors[0].id,amount:"500"}]},admin)).status,409);
      assert.deepEqual(await returnsOf(o.id,o.investors),["100","100","100","100","100"]);
      // The first monthly payment of 155 is now accepted: 125 principal and 30 profit, 25 and 6 each.
      assert.equal((await monthly(o)).status,201);
      const credits=(await pool.query("SELECT principal_uzs::text AS p,profit_uzs::text AS f FROM investor_monthly_allocations WHERE store_id=$1 AND order_id=$2",[storeId,o.id])).rows;
      assert.deepEqual(credits,Array(5).fill({p:"25",f:"6"}));
    }

    // 2. An initial paid in two parts (300, then 200) is returned 60 and then 40 to each investor.
    {
      const o=await soldOrder(["300","200"]);const returns=o.path+"/capital-returns";
      const first=(await call(returns,"GET",undefined,admin)).data.receipts;
      assert.deepEqual(first.map(r=>r.amount_uzs),["300","200"]);
      assert.deepEqual(first[0].shares.map(x=>x.amount_uzs),["60","60","60","60","60"]);
      assert.equal((await call(returns,"POST",{receiptId:first[0].id},admin)).status,201);
      const second=(await call(returns,"GET",undefined,admin)).data.receipts[1];
      assert.deepEqual(second.shares.map(x=>x.amount_uzs),["40","40","40","40","40"]);
      assert.equal((await call(returns,"POST",{receiptId:second.id},admin)).status,201);
      assert.deepEqual(await returnsOf(o.id,o.investors),["100","100","100","100","100"]);
      assert.equal((await monthly(o)).status,201);
    }

    // 3. An older split typed by hand (250 and 250 to two investors, nothing to three) blocks the monthly
    //    payment with a message the seller can act on, and the administrator can correct it while the
    //    capital returned in excess is still free.
    {
      const o=await soldOrder(["500"]);const returns=o.path+"/capital-returns";const [a,b]=o.investors;
      const receiptId=(await call(returns,"GET",undefined,admin)).data.receipts[0].id;
      const typedAt="2026-01-15T10:00:00.000Z";
      for(const investor of [a,b])await pool.query("INSERT INTO investor_initial_returns(store_id,order_id,receipt_id,investor_account_id,amount_uzs,recorded_by,created_at) VALUES($1,$2,$3,$4,250,$5,$6)",
        [storeId,o.id,receiptId,investor.id,admin.id,typedAt]);
      const blocked=await monthly(o);
      assert.equal(blocked.status,409);assert.match(blocked.data.error,/ulushiga mos taqsimlanmagan.*administrator.*Kapital qaytimi/);
      const view=(await call(returns,"GET",undefined,admin)).data;
      assert.equal(view.correction.allowed,true);
      assert.deepEqual(view.correction.rows.map(r=>[r.current_uzs,r.target_uzs]),[["250","100"],["250","100"],["0","100"],["0","100"],["0","100"]]);
      assert.equal((await call(returns,"GET",undefined,seller)).data.correction.allowed,false);
      assert.equal((await call(returns,"POST",{action:"rebalance"},seller)).status,403);
      // Investor A took 200 of the 250 that came back. 150 of it must return to this product, so it is not safe.
      assert.equal((await contribute(a,"200","withdrawal")).status,201);
      const unsafe=(await call(returns,"GET",undefined,admin)).data.correction;
      assert.equal(unsafe.allowed,false);assert.match(unsafe.reason,/boshqa mahsulotga ajratilgan yoki yechib olingan/);
      assert.equal((await call(returns,"POST",{action:"rebalance"},admin)).status,409);
      assert.deepEqual(await returnsOf(o.id,o.investors),["250","250","0","0","0"]);
      // Once the money is back the correction goes through and every investor holds their own 100.
      assert.equal((await contribute(a,"200")).status,201);
      assert.equal((await call(returns,"GET",undefined,admin)).data.correction.allowed,true);
      assert.equal((await call(returns,"POST",{action:"rebalance"},admin)).status,201);
      assert.deepEqual(await returnsOf(o.id,o.investors),["100","100","100","100","100"]);
      const log=(await pool.query("SELECT investor_account_id,old_amount_uzs::text AS old,new_amount_uzs::text AS new FROM investor_initial_return_corrections WHERE store_id=$1 AND order_id=$2",[storeId,o.id])).rows;
      assert.deepEqual(o.investors.map(i=>{const r=log.find(x=>x.investor_account_id===i.id);return [r.old,r.new];}),[["250","100"],["250","100"],["0","100"],["0","100"],["0","100"]]);
      const dates=(await pool.query("SELECT DISTINCT created_at FROM investor_initial_returns WHERE store_id=$1 AND order_id=$2",[storeId,o.id])).rows;
      assert.equal(dates.length,1);assert.equal(dates[0].created_at.toISOString(),typedAt);
      const fixed=(await call(returns,"GET",undefined,admin)).data;
      assert.equal(fixed.correction,null);
      assert.deepEqual(fixed.allocations.map(x=>x.outstanding_uzs),["150","150","150","150","150"]);
      assert.equal((await call(returns,"POST",{action:"rebalance"},admin)).status,409);
      assert.equal((await call("/api/investor/summary","GET",undefined,a)).data.available_uzs,"100");
      assert.equal((await call("/api/investor/summary","GET",undefined,o.investors[4])).data.available_uzs,"100");
      assert.equal((await monthly(o)).status,201);
      // After a monthly payment is posted the split can no longer change.
      assert.equal((await call(returns,"POST",{action:"rebalance"},admin)).status,409);
    }
  }finally{await pool.end();}
});
