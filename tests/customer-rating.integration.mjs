import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes,randomUUID,createHash} from "node:crypto";
import pg from "pg";

// Runs against the disposable database used by staff-api.integration.mjs. It can also run alone.
const origin="http://127.0.0.1:3100";
const storeId="00000000-0000-4000-8000-000000000001";

test("customer rating is derived from instalment payments and is visible to staff only",async()=>{
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
    const seller=await session("seller");const admin=await session("admin");const investor=await session("investor");
    const day=async offset=>(await pool.query("SELECT (((now() AT TIME ZONE 'Asia/Tashkent')::date)+$1::int)::text AS d",[offset])).rows[0].d;
    const today=await day(0);
    const ratingsPath="/api/admin/customers/ratings";

    // A customer with an active three-month contract: cost 1000, initial 250, markup 90, instalments of 280.
    async function customerWithContract(name){
      const product=randomUUID();const variant=randomUUID();
      await pool.query("INSERT INTO products(id,store_id,name,category,published) VALUES($1,$2,'Rating fixture','Allocation',false)",[product,storeId]);
      await pool.query("INSERT INTO variants(id,store_id,product_id,sku,color,price_uzs,quantity) VALUES($1,$2,$3,$4,'Oq',300,1)",[variant,storeId,product,"RATE-"+variant.slice(0,8)]);
      const order=await call("/api/admin/orders","POST",{variantId:variant,quantity:1,requestKey:randomUUID()},seller);
      assert.equal(order.status,201);
      const path="/api/admin/orders/"+order.data.id;
      assert.equal((await call(path+"/payments","POST",{action:"terms",type:"installment",cost:"1000",initial:"250",months:3},seller)).status,201);
      assert.equal((await call(path+"/payments","POST",{action:"receipt",amount:"250",method:"cash",date:today,key:randomUUID()},seller)).status,201);
      const customer=await call("/api/admin/customers","POST",{action:"create",name,phone:"+1202561"+String(Math.floor(Math.random()*9000)+1000),passport:"RATE"+String(Math.floor(Math.random()*9000)+1000)},seller);
      assert.equal(customer.status,201);
      assert.equal((await call(path+"/customer","PUT",{customerId:customer.data.customer.id},seller)).status,200);
      assert.equal((await call(path+"/installments","POST",{action:"activate",months:3,firstDate:await day(40)},seller)).status,201);
      const rows=(await call(path+"/installments","GET",undefined,seller)).data.schedule;
      assert.deepEqual(rows.map(r=>r.amount_uzs),["280","280","280"]);
      return {id:customer.data.customer.id,order:order.data.id,path,rows};
    }
    // Schedules cannot start in the past through the app, so the fixtures move due dates and receipt dates directly.
    const due=(row,offset)=>pool.query("UPDATE installment_schedule SET due_date=((now() AT TIME ZONE 'Asia/Tashkent')::date)+$2::int WHERE store_id=$1 AND id=$3",[storeId,offset,row.id]);
    const pay=async(c,row,amount,offset)=>{
      const key=randomUUID();
      // The order is not sold, so no investor posting is involved: only the receipt itself matters here.
      await pool.query("INSERT INTO installment_receipts(store_id,schedule_id,amount_uzs,idempotency_key,recorded_by,received_on,method) VALUES($1,$2,$3,$4,$5,((now() AT TIME ZONE 'Asia/Tashkent')::date)+$6::int,'cash')",[storeId,row.id,amount,key,seller.id,offset]);
      return (await pool.query("SELECT id FROM installment_receipts WHERE store_id=$1 AND idempotency_key=$2",[storeId,key])).rows[0].id;
    };
    const one=async(id,auth=seller)=>(await call(ratingsPath+"?id="+id,"GET",undefined,auth));

    // 1. Nothing due yet: a new customer, no level.
    const fresh=await customerWithContract("Rating Yangi");
    const first=await one(fresh.id);
    assert.equal(first.status,200);
    assert.equal(first.data.customer.rating.level,null);assert.equal(first.data.customer.rating.score,null);
    assert.match(first.data.customer.rating.reason,/Yangi mijoz, tarix yo‘q/);
    assert.equal(first.data.customer.rating.remainingDebt,"840");
    assert.equal(first.data.customer.name,"Rating Yangi");assert.equal("phone" in first.data.customer,false);

    // 2. Three due instalments, all paid on their dates: 40 + 25 + 20 + 10 (first contract) = 95, "Ideal mijoz".
    const ideal=await customerWithContract("Rating Ideal");
    for(const [i,row] of ideal.rows.entries()){await due(row,-90+i*30);await pay(ideal,row,280,-90+i*30);}
    const idealRating=(await one(ideal.id)).data.customer.rating;
    assert.deepEqual([idealRating.level.key,idealRating.level.name,idealRating.score],["A+","Ideal mijoz",95]);
    assert.deepEqual([idealRating.due,idealRating.onTime,idealRating.late,idealRating.overdue,idealRating.remainingDebt],[3,3,0,0,"0"]);
    assert.deepEqual(idealRating.recent.map(m=>m.state),["on_time","on_time","on_time"]);

    // 3. One instalment paid 10 days late, one within the 3-day grace, one overdue for 5 days with a part payment.
    const mixed=await customerWithContract("Rating Aralash");
    await due(mixed.rows[0],-65);await pay(mixed,mixed.rows[0],280,-55);
    await due(mixed.rows[1],-35);await pay(mixed,mixed.rows[1],280,-32);
    await due(mixed.rows[2],-5);const part=await pay(mixed,mixed.rows[2],100,-5);
    let rating=(await one(mixed.id)).data.customer.rating;
    // on time 1 of 3 -> 13; worst delay 10 days (Riskli) -> 12; paid 660 of 840 -> 16; first contract -> 10. Total 51.
    assert.deepEqual([rating.level.key,rating.score,rating.parts],["C",51,{onTime:13,delay:12,paidInFull:16,priorContracts:10}]);
    assert.deepEqual([rating.onTime,rating.late,rating.overdue,rating.overdueAmount,rating.oldestOverdueDays,rating.worstDelayDays],[1,1,1,"180",5,10]);
    assert.deepEqual(rating.recent.map(m=>[m.state,m.days]),[["late",10],["on_time",3],["overdue",5]]);
    assert.match(rating.reason,/3 to‘lovdan 1 tasi vaqtida, 1 tasi kechikib to‘langan \(eng ko‘pi 10 kun\), 1 tasi hozir to‘lanmagan \(eng eskisi 5 kun\)/);
    // A reversed receipt does not count: the part payment disappears from the facts.
    await pool.query("INSERT INTO installment_receipt_reversals(store_id,receipt_id,reversed_by,reason) VALUES($1,$2,$3,'Fixture reversal')",[storeId,part,admin.id]);
    rating=(await one(mixed.id)).data.customer.rating;
    assert.equal(rating.overdueAmount,"280");assert.equal(rating.parts.paidInFull,13);

    // 4. The list carries every customer with the same rating and can be read by admin and seller only.
    const list=await call(ratingsPath,"GET",undefined,admin);
    assert.equal(list.status,200);
    const inList=id=>list.data.customers.find(c=>c.id===id);
    assert.equal(inList(ideal.id).rating.score,95);assert.equal(inList(fresh.id).rating.level,null);assert.equal(inList(mixed.id).rating.level.key,"C");
    assert.equal((await call(ratingsPath,"GET",undefined,seller)).status,200);
    assert.equal((await call(ratingsPath,"GET",undefined,investor)).status,403);
    assert.equal((await one(ideal.id,investor)).status,403);
    assert.equal((await one(randomUUID())).status,404);
    assert.equal((await one("not-a-uuid")).status,404);
    assert.equal((await fetch(origin+ratingsPath)).status,403);
    // Investor endpoints carry no customer rating.
    assert.equal(JSON.stringify((await call("/api/investor/summary","GET",undefined,investor)).data).includes("rating"),false);
  }finally{await pool.end();}
});
