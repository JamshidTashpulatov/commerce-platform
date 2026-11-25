import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes,randomUUID,createHash} from "node:crypto";
import pg from "pg";

// Runs against the disposable database used by staff-api.integration.mjs. It can also run alone.
const origin="http://127.0.0.1:3100";
const storeId="00000000-0000-4000-8000-000000000001";

test("a partial installment receipt credits only the investors who funded the sold product",async()=>{
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
    // A and B fund the product with different amounts. C holds capital in the store but funds nothing here.
    const a=await session("investor");const b=await session("investor");const c=await session("investor");

    const product=randomUUID();const variant=randomUUID();
    await pool.query("INSERT INTO products(id,store_id,name,category,published) VALUES($1,$2,'Allocation fixture','Allocation',false)",[product,storeId]);
    await pool.query("INSERT INTO variants(id,store_id,product_id,sku,color,price_uzs,quantity) VALUES($1,$2,$3,$4,'Oq',10900000,1)",
      [variant,storeId,product,"ALLOC-"+variant.slice(0,8)]);
    const order=await call("/api/admin/orders","POST",{variantId:variant,quantity:1,requestKey:randomUUID()},seller);
    assert.equal(order.status,201);
    const path="/api/admin/orders/"+order.data.id;
    const date=(await pool.query("SELECT ((now() AT TIME ZONE 'Asia/Tashkent')::date)::text AS d")).rows[0].d;

    // Cost 10 000 000, initial 2 500 000, three months at 4% a month:
    // financed principal 7 500 000, markup 900 000, three instalments of 2 800 000.
    assert.equal((await call(path+"/payments","POST",{action:"terms",type:"installment",cost:"10000000",initial:"2500000",months:3},seller)).status,201);
    assert.equal((await call(path+"/payments","POST",{action:"receipt",amount:"2500000",method:"cash",date,key:randomUUID()},seller)).status,201);
    const terms=(await call(path+"/payments","GET",undefined,seller)).data.terms;
    assert.equal(terms.financed_principal_uzs,"7500000");assert.equal(terms.markup_uzs,"900000");
    const customer=await call("/api/admin/customers","POST",
      {action:"create",name:"Allocation Fixture",phone:"+1202555"+String(Math.floor(Math.random()*9000)+1000),passport:"FIXTURE02"},seller);
    assert.equal(customer.status,201);
    assert.equal((await call(path+"/customer","PUT",{customerId:customer.data.customer.id},seller)).status,200);
    const schedulePath=path+"/installments";
    assert.equal((await call(schedulePath,"POST",{action:"activate",months:3,firstDate:"2027-01-31"},seller)).status,201);
    const rows=(await call(schedulePath,"GET",undefined,seller)).data.schedule;
    assert.deepEqual(rows.map(r=>r.amount_uzs),["2800000","2800000","2800000"]);

    for(const [investor,amount] of [[a,"6000000"],[b,"4000000"],[c,"5000000"]]){
      assert.equal((await call("/api/admin/investors","POST",{accountId:investor.id,type:"contribution",amount,key:randomUUID()},admin)).status,201);
    }
    assert.equal((await call(path+"/funding","PUT",{allocations:[{accountId:a.id,amount:"6000000"},{accountId:b.id,amount:"4000000"}]},seller)).status,200);
    const revision=(await call(path,"GET",undefined,seller)).data.order.revision;
    assert.equal((await call(path+"/sale","POST",{revision},seller)).status,200);
    const initialReceipt=(await call(path+"/capital-returns","GET",undefined,admin)).data.receipts[0];
    assert.equal((await call(path+"/capital-returns","POST",
      {receiptId:initialReceipt.id,entries:[{accountId:a.id,amount:"1500000"},{accountId:b.id,amount:"1000000"}]},admin)).status,201);

    const allocations=async receiptId=>Object.fromEntries((await pool.query(
      "SELECT investor_account_id,principal_uzs,profit_uzs FROM investor_monthly_allocations WHERE store_id=$1 AND receipt_id=$2",
      [storeId,receiptId])).rows.map(r=>[r.investor_account_id,[r.principal_uzs,r.profit_uzs]]));
    const summary=async investor=>(await call("/api/investor/summary","GET",undefined,investor)).data;
    const untouched=async()=>{
      const own=await summary(c);
      assert.equal(own.received_profit_uzs,"0");assert.equal(own.returned_uzs,"0");assert.equal(own.allocated_uzs,"0");
      assert.equal(own.available_uzs,"5000000");assert.deepEqual(own.allocations,[]);
      for(const table of ["investor_monthly_allocations","installment_receipt_funding_weights","investor_initial_returns"]){
        assert.equal((await pool.query("SELECT count(*)::int AS n FROM "+table+" WHERE store_id=$1 AND investor_account_id=$2",[storeId,c.id])).rows[0].n,0);
      }
    };

    // Partial payment of 1 000 000 against the first instalment.
    // Principal = round(1 000 000 × 7 500 000 / 8 400 000) = 892 857. Profit = 107 143.
    const partial={action:"receipt",scheduleId:rows[0].id,amount:"1000000",date,method:"cash",key:randomUUID()};
    const first=await call(schedulePath,"POST",partial,seller);
    assert.equal(first.status,201);
    const receiptId=(await pool.query("SELECT id FROM installment_receipts WHERE store_id=$1 AND idempotency_key=$2",[storeId,partial.key])).rows[0].id;
    const expected={[a.id]:["535714","64286"],[b.id]:["357143","42857"]};
    assert.deepEqual(await allocations(receiptId),expected);
    const posted=(await call(schedulePath,"GET",undefined,seller)).data.receipts.find(r=>r.id===receiptId);
    assert.equal(posted.principal_uzs,"892857");assert.equal(posted.profit_uzs,"107143");
    assert.equal(BigInt(posted.principal_uzs)+BigInt(posted.profit_uzs),1000000n);

    // Resending the same payment returns the original receipt and posts nothing new.
    const retry=await call(schedulePath,"POST",partial,seller);
    assert.equal(retry.status,200);assert.equal(retry.data.repeated,true);assert.equal(retry.data.id,receiptId);
    assert.equal((await Promise.all([1,2,3].map(()=>call(schedulePath,"POST",partial,seller)))).every(r=>r.status===200&&r.data.id===receiptId),true);
    assert.equal((await call(schedulePath,"POST",{...partial,amount:"999999"},seller)).status,409);
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM installment_receipts r JOIN installment_schedule s
      ON s.store_id=r.store_id AND s.id=r.schedule_id WHERE r.store_id=$1 AND s.id=$2`,[storeId,rows[0].id])).rows[0].n,1);
    assert.deepEqual(await allocations(receiptId),expected);

    const ownA=await summary(a);const ownB=await summary(b);
    assert.equal(ownA.returned_uzs,"2035714");assert.equal(ownA.outstanding_uzs,"3964286");assert.equal(ownA.received_profit_uzs,"64286");
    assert.equal(ownB.returned_uzs,"1357143");assert.equal(ownB.outstanding_uzs,"2642857");assert.equal(ownB.received_profit_uzs,"42857");
    assert.equal(ownA.available_uzs,"2035714");assert.equal(ownB.available_uzs,"1357143");
    await untouched();

    // The rest of the first instalment brings cumulative receipts to 2 800 000:
    // exactly 2 500 000 principal and 300 000 profit, so the earlier rounding is absorbed.
    const rest={...partial,amount:"1800000",key:randomUUID()};
    assert.equal((await call(schedulePath,"POST",rest,seller)).status,201);
    const restId=(await pool.query("SELECT id FROM installment_receipts WHERE store_id=$1 AND idempotency_key=$2",[storeId,rest.key])).rows[0].id;
    assert.deepEqual(await allocations(restId),{[a.id]:["964286","115714"],[b.id]:["642857","77143"]});

    for(const row of rows.slice(1)){
      assert.equal((await call(schedulePath,"POST",{...partial,scheduleId:row.id,amount:row.amount_uzs,key:randomUUID()},seller)).status,201);
    }
    const settledA=await summary(a);const settledB=await summary(b);
    assert.equal(settledA.outstanding_uzs,"0");assert.equal(settledA.returned_uzs,"6000000");assert.equal(settledA.received_profit_uzs,"540000");
    assert.equal(settledB.outstanding_uzs,"0");assert.equal(settledB.returned_uzs,"4000000");assert.equal(settledB.received_profit_uzs,"360000");
    const totals=(await pool.query(`SELECT sum(principal_uzs)::text AS principal,sum(profit_uzs)::text AS profit
      FROM investor_monthly_allocations WHERE store_id=$1 AND order_id=$2`,[storeId,order.data.id])).rows[0];
    assert.equal(totals.principal,"7500000");assert.equal(totals.profit,"900000");
    assert.equal((await call(schedulePath,"GET",undefined,seller)).data.contract.status,"settled");
    await untouched();
  }finally{await pool.end();}
});
