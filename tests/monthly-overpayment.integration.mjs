import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes,randomUUID,createHash} from "node:crypto";
import pg from "pg";

// Runs against the disposable database used by staff-api.integration.mjs. It can also run alone.
const origin="http://127.0.0.1:3100";
const storeId="00000000-0000-4000-8000-000000000001";

test("a monthly payment above the month's balance is spread over the following months as one payment",async()=>{
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
    const date=(await pool.query("SELECT ((now() AT TIME ZONE 'Asia/Tashkent')::date)::text AS d")).rows[0].d;

    // Cost 1250, initial 500, six months at 4% a month: financed 750, markup 180, six instalments of 155.
    const product=randomUUID();const variant=randomUUID();
    await pool.query("INSERT INTO products(id,store_id,name,category,published) VALUES($1,$2,'Overpayment fixture','Allocation',false)",[product,storeId]);
    await pool.query("INSERT INTO variants(id,store_id,product_id,sku,color,price_uzs,quantity) VALUES($1,$2,$3,$4,'Oq',1475,1)",[variant,storeId,product,"OVER-"+variant.slice(0,8)]);
    const order=await call("/api/admin/orders","POST",{variantId:variant,quantity:1,requestKey:randomUUID()},seller);
    assert.equal(order.status,201);
    const path="/api/admin/orders/"+order.data.id;const schedulePath=path+"/installments";
    assert.equal((await call(path+"/payments","POST",{action:"terms",type:"installment",cost:"1250",initial:"500",months:6},seller)).status,201);
    assert.equal((await call(path+"/payments","POST",{action:"receipt",amount:"500",method:"cash",date,key:randomUUID()},seller)).status,201);
    const customer=await call("/api/admin/customers","POST",
      {action:"create",name:"Overpayment Fixture",phone:"+1202558"+String(Math.floor(Math.random()*9000)+1000),passport:"FIXTURE03"},seller);
    assert.equal(customer.status,201);
    assert.equal((await call(path+"/customer","PUT",{customerId:customer.data.customer.id},seller)).status,200);
    assert.equal((await call(schedulePath,"POST",{action:"activate",months:6,firstDate:"2027-01-31"},seller)).status,201);
    for(const [investor,amount] of [[a,"750"],[b,"500"]])
      assert.equal((await call("/api/admin/investors","POST",{accountId:investor.id,type:"contribution",amount,key:randomUUID()},admin)).status,201);
    assert.equal((await call(path+"/funding","PUT",{allocations:[{accountId:a.id,amount:"750"},{accountId:b.id,amount:"500"}]},admin)).status,200);
    const revision=(await call(path,"GET",undefined,seller)).data.order.revision;
    assert.equal((await call(path+"/sale","POST",{revision},seller)).status,200);
    const initialReceipt=(await call(path+"/capital-returns","GET",undefined,admin)).data.receipts[0];
    assert.equal((await call(path+"/capital-returns","POST",{receiptId:initialReceipt.id,entries:[{accountId:a.id,amount:"300"},{accountId:b.id,amount:"200"}]},admin)).status,201);

    const view=async()=>(await call(schedulePath,"GET",undefined,seller)).data;
    const rows=(await view()).schedule;
    assert.deepEqual(rows.map(r=>r.amount_uzs),["155","155","155","155","155","155"]);
    const stored=async()=>(await pool.query(`SELECT s.sequence_no,r.amount_uzs::text AS amount,r.payment_key,r.idempotency_key,
        EXISTS(SELECT 1 FROM installment_receipt_reversals v WHERE v.store_id=r.store_id AND v.receipt_id=r.id) AS reversed
      FROM installment_receipts r JOIN installment_schedule s ON s.store_id=r.store_id AND s.id=r.schedule_id
      JOIN installment_contracts k ON k.store_id=s.store_id AND k.id=s.contract_id
      WHERE k.store_id=$1 AND k.order_id=$2 ORDER BY r.received_at,s.sequence_no`,[storeId,order.data.id])).rows;
    const credited=async()=>(await pool.query(`SELECT COALESCE(sum(principal_uzs),0)::text AS principal,COALESCE(sum(profit_uzs),0)::text AS profit
      FROM active_monthly_allocations WHERE store_id=$1 AND order_id=$2`,[storeId,order.data.id])).rows[0];

    // 1. The customer pays 200 when the month owes 155: 155 stays in month 1 and 45 goes to month 2.
    const payment={action:"receipt",scheduleId:rows[0].id,amount:"200",date,method:"cash",key:randomUUID()};
    const first=await call(schedulePath,"POST",payment,seller);
    assert.equal(first.status,201);
    let saved=await stored();
    assert.deepEqual(saved.map(r=>[r.sequence_no,r.amount]),[[1,"155"],[2,"45"]]);
    assert.equal(saved[0].idempotency_key,payment.key);
    assert.ok(saved.every(r=>r.payment_key===payment.key));
    assert.deepEqual((await view()).schedule.map(r=>[r.paid_uzs,r.state]).slice(0,3),[["155","paid"],["45","pending"],["0","pending"]]);
    // Principal and profit follow the cumulative formula on 200 of 930: round(200 × 750 / 930) = 161 principal, 39 profit.
    assert.deepEqual(await credited(),{principal:"161",profit:"39"});
    const history=(await view()).receipts;
    assert.equal(history.length,2);
    assert.equal(history.reduce((n,r)=>n+BigInt(r.principal_uzs)+BigInt(r.profit_uzs),0n),200n);
    assert.ok(history.every(r=>r.payment_key===payment.key));

    // 2. One payment, one key: repeating it records nothing; the same key with another amount is refused.
    const retry=await call(schedulePath,"POST",payment,seller);
    assert.equal(retry.status,200);assert.equal(retry.data.repeated,true);
    assert.equal((await Promise.all([1,2,3].map(()=>call(schedulePath,"POST",payment,seller)))).every(r=>r.status===200&&r.data.repeated),true);
    assert.equal((await call(schedulePath,"POST",{...payment,amount:"155"},seller)).status,409);
    assert.equal((await stored()).length,2);
    assert.deepEqual(await credited(),{principal:"161",profit:"39"});

    // 3. 730 is still owed. 731 is refused and records nothing; a month that is paid takes no payment.
    const tooMuch=await call(schedulePath,"POST",{...payment,scheduleId:rows[1].id,amount:"731",key:randomUUID()},seller);
    assert.equal(tooMuch.status,409);assert.match(tooMuch.data.error,/qolgan qarzidan oshmoqda.*\$730/);
    const paidMonth=await call(schedulePath,"POST",{...payment,amount:"10",key:randomUUID()},seller);
    assert.equal(paidMonth.status,409);assert.match(paidMonth.data.error,/to‘liq to‘langan/);
    assert.equal((await stored()).length,2);

    // 4. Reversing the payment from either of its months reverses the whole payment.
    const second=(await view()).receipts.find(r=>r.sequence_no===2);
    assert.equal((await call(schedulePath,"POST",{action:"reverse",receiptId:second.id,reason:"Sinov: xato summa"},seller)).status,403);
    assert.equal((await call(schedulePath,"POST",{action:"reverse",receiptId:second.id,reason:"Sinov: xato summa"},admin)).status,201);
    saved=await stored();
    assert.ok(saved.length===2&&saved.every(r=>r.reversed));
    assert.deepEqual(await credited(),{principal:"0",profit:"0"});
    assert.deepEqual((await view()).schedule.map(r=>r.paid_uzs),["0","0","0","0","0","0"]);
    assert.equal((await call(schedulePath,"POST",{action:"reverse",receiptId:second.id,reason:"Sinov: xato summa"},admin)).status,409);

    // 5. A payment inside the month is one ordinary receipt, as before.
    const inside={...payment,amount:"100",key:randomUUID()};
    assert.equal((await call(schedulePath,"POST",inside,seller)).status,201);
    const plain=(await stored()).filter(r=>!r.reversed);
    assert.deepEqual(plain.map(r=>[r.sequence_no,r.amount,r.payment_key]),[[1,"100",null]]);

    // 6. The whole remaining 830 in one payment settles the contract: 750 principal and 180 profit in all.
    const all={...payment,scheduleId:rows[0].id,amount:"830",key:randomUUID()};
    assert.equal((await call(schedulePath,"POST",all,seller)).status,201);
    const done=await view();
    assert.equal(done.contract.status,"settled");
    assert.ok(done.schedule.every(r=>r.state==="paid"&&r.paid_uzs===r.amount_uzs));
    assert.deepEqual((await stored()).filter(r=>r.payment_key===all.key).map(r=>[r.sequence_no,r.amount]),[[1,"55"],[2,"155"],[3,"155"],[4,"155"],[5,"155"],[6,"155"]]);
    assert.deepEqual(await credited(),{principal:"750",profit:"180"});
    for(const [investor,profit] of [[a,"108"],[b,"72"]]){
      const own=(await call("/api/investor/summary","GET",undefined,investor)).data;
      assert.equal(own.outstanding_uzs,"0");assert.equal(own.received_profit_uzs,profit);
    }
    assert.equal((await call(schedulePath,"POST",{...payment,amount:"1",key:randomUUID()},seller)).status,409);
  }finally{await pool.end();}
});
