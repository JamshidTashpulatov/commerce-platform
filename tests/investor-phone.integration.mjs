import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes,randomUUID,createHash,createHmac} from "node:crypto";
import pg from "pg";

// Runs against the disposable database used by staff-api.integration.mjs. It can also run alone.
const origin="http://127.0.0.1:3100";
const storeId="00000000-0000-4000-8000-000000000001";

test("an investor created by phone signs in only after Telegram delivers their own contact",async()=>{
  assert.equal(process.env.COMMERCE_TEST_MODE,"1");
  const url=new URL(process.env.DATABASE_URL);
  assert.equal(url.hostname,"127.0.0.1");assert.equal(url.pathname,"/commerce_test");
  const secret=process.env.TELEGRAM_WEBHOOK_SECRET;assert.ok(secret);
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
    async function call(path,method="GET",body,cookie){
      const res=await fetch(origin+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{"Content-Type":"application/json",Origin:origin})},
        ...(body===undefined?{}:{body:JSON.stringify(body)})});
      return {status:res.status,data:await res.json(),cookie:res.headers.get("set-cookie")?.split(";")[0]};
    }
    // Signed Mini App launch data for a Telegram user, as Telegram would produce it.
    function initData(telegramId){
      const fields=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),query_id:randomUUID(),user:JSON.stringify({id:telegramId})});
      const key=createHmac("sha256","WebAppData").update(process.env.TELEGRAM_BOT_TOKEN).digest();
      fields.set("hash",createHmac("sha256",key).update([...fields].map(([k,v])=>k+"="+v).join("\n")).digest("hex"));
      return fields.toString();
    }
    const login=data=>call("/api/auth/telegram-mini-app","POST",{initData:data});
    let updateId=Math.floor(Math.random()*1e9);
    // A contact message as the bot receives it. `owner` is the Telegram id inside the contact card.
    async function contact({from,owner=from,phone,token=secret,id=++updateId,chat="private",date=Math.floor(Date.now()/1000)}){
      const res=await fetch(origin+"/api/telegram/webhook",{method:"POST",headers:{"Content-Type":"application/json",...(token===null?{}:{"X-Telegram-Bot-Api-Secret-Token":token})},
        body:JSON.stringify({update_id:id,message:{message_id:1,date,chat:{id:from,type:chat},from:{id:from,is_bot:false,first_name:"T"},contact:{phone_number:phone,first_name:"T",user_id:owner}}})});
      return {status:res.status,id};
    }
    const linked=async account=>(await pool.query("SELECT telegram_user_id FROM accounts WHERE id=$1",[account])).rows[0].telegram_user_id;

    const admin=await session("admin");const seller=await session("seller");
    const digits=String(Math.floor(Math.random()*1e9)).padStart(9,"0");
    const phone="+998"+digits;
    const tg=700000000+Math.floor(Math.random()*1e8);const other=tg+1;const third=tg+2;
    const accounts="/api/admin/investors/accounts";

    // Create by phone: admin only, validated, duplicates refused, phone never stored or returned in the clear.
    assert.equal((await call(accounts,"POST",{name:"Phone investor",phone},seller.cookie)).status,403);
    assert.equal((await call(accounts,"POST",{name:"Phone investor",phone:"+99890123"},admin.cookie)).status,400);
    assert.equal((await call(accounts,"POST",{name:"Phone investor",phone:"+12025550100"},admin.cookie)).status,400);
    const created=await call(accounts,"POST",{name:"Phone investor",phone:"+998 "+digits.slice(0,2)+" "+digits.slice(2)},admin.cookie);
    assert.equal(created.status,201);
    const investorId=created.data.id;
    const duplicate=await call(accounts,"POST",{name:"Somebody else",phone},admin.cookie);
    assert.equal(duplicate.status,409);
    const stored=(await pool.query("SELECT phone_cipher,phone_lookup,bound_at FROM account_sign_in_phones WHERE store_id=$1 AND account_id=$2",[storeId,investorId])).rows[0];
    assert.equal(stored.bound_at,null);
    assert.equal(JSON.stringify(stored).includes(digits),false);
    assert.equal(await linked(investorId),null);
    const listed=(await call("/api/admin/investors","GET",undefined,admin.cookie)).data.items.find(i=>i.account_id===investorId);
    assert.equal(listed.sign_in,"pending");assert.equal(listed.by_phone,true);
    assert.equal(listed.phone_masked,"+998 ••• •• "+digits.slice(-2));
    assert.equal(JSON.stringify(listed).includes(digits),false);
    assert.equal("phone_cipher" in listed,false);

    // Before any contact arrives the Mini App is refused, and the refusal does not use up the launch data.
    const launch=initData(tg);
    assert.equal((await login(launch)).status,403);

    // The webhook only listens to Telegram: the secret header is required.
    assert.equal((await contact({from:tg,phone,token:null})).status,403);
    assert.equal((await contact({from:tg,phone,token:"wrong-secret-wrong-secret-wrong-secret"})).status,403);
    assert.equal(await linked(investorId),null);
    // Somebody else's contact card, a group chat, a stale message and an unknown phone bind nothing.
    assert.equal((await contact({from:other,owner:tg,phone})).status,200);
    assert.equal((await contact({from:tg,phone,chat:"group"})).status,200);
    assert.equal((await contact({from:tg,phone,date:Math.floor(Date.now()/1000)-3600})).status,200);
    assert.equal((await contact({from:tg,phone:"+998000000001"})).status,200);
    assert.equal(await linked(investorId),null);
    assert.equal((await login(launch)).status,403);

    // The person's own contact binds the Telegram user, once. Telegram may omit the plus sign.
    const sent=await contact({from:tg,phone:phone.slice(1)});
    assert.equal(sent.status,200);
    assert.equal(await linked(investorId),String(tg));
    assert.notEqual((await pool.query("SELECT bound_at FROM account_sign_in_phones WHERE account_id=$1",[investorId])).rows[0].bound_at,null);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_events WHERE entity_id=$1 AND action='investor_sign_in_bound'",[investorId])).rows[0].n,1);

    // Sign-in now works with the same launch data, gives an investor session and nothing more, and cannot be replayed.
    const signedIn=await login(launch);
    assert.equal(signedIn.status,200);assert.equal(signedIn.data.role,"investor");
    assert.equal((await login(launch)).status,409);
    assert.equal((await call("/api/investor/summary","GET",undefined,signedIn.cookie)).status,200);
    assert.equal((await call("/api/admin/orders","GET",undefined,signedIn.cookie)).status,403);
    assert.equal((await call("/api/admin/investors","GET",undefined,signedIn.cookie)).status,403);
    assert.equal((await pool.query("SELECT role FROM memberships WHERE store_id=$1 AND account_id=$2",[storeId,investorId])).rows[0].role,"investor");
    assert.equal((await call("/api/admin/investors","GET",undefined,admin.cookie)).data.items.find(i=>i.account_id===investorId).sign_in,"linked");

    // A second Telegram user cannot take the same phone, and a repeated update is ignored.
    assert.equal((await contact({from:other,phone})).status,200);
    assert.equal((await contact({from:tg,phone,id:sent.id})).status,200);
    assert.equal(await linked(investorId),String(tg));
    assert.equal((await login(initData(other))).status,403);

    // A phone row never turns into an admin session: binding is limited to investor memberships.
    const adminPhone="+998"+String(Math.floor(Math.random()*1e9)).padStart(9,"0");
    const extraAdmin=await session("admin");
    const lookupOf=async p=>{ // the lookup is an HMAC, so reuse the server through a throwaway investor created with that phone
      const made=await call(accounts,"POST",{name:"Lookup helper",phone:p},admin.cookie);assert.equal(made.status,201);
      const row=(await pool.query("SELECT phone_cipher,phone_lookup FROM account_sign_in_phones WHERE account_id=$1",[made.data.id])).rows[0];
      await pool.query("DELETE FROM account_sign_in_phones WHERE account_id=$1",[made.data.id]);
      return row;
    };
    const helper=await lookupOf(adminPhone);
    await pool.query("INSERT INTO account_sign_in_phones(store_id,account_id,phone_cipher,phone_lookup,created_by) VALUES($1,$2,$3,$4,$5)",[storeId,extraAdmin.id,helper.phone_cipher,helper.phone_lookup,admin.id]);
    assert.equal((await contact({from:third,phone:adminPhone})).status,200);
    assert.equal(await linked(extraAdmin.id),null);
    assert.equal((await login(initData(third))).status,403);

    // Reset is an explicit admin action: it unlinks Telegram, ends sessions and allows one new binding.
    assert.equal((await call(accounts,"POST",{action:"resetSignIn",accountId:investorId},seller.cookie)).status,403);
    assert.equal((await call(accounts,"POST",{action:"resetSignIn",accountId:investorId},signedIn.cookie)).status,403);
    assert.equal((await call(accounts,"POST",{action:"resetSignIn",accountId:extraAdmin.id},admin.cookie)).status,409);
    assert.equal((await call(accounts,"POST",{action:"resetSignIn",accountId:investorId},admin.cookie)).status,200);
    assert.equal(await linked(investorId),null);
    assert.equal((await call("/api/investor/summary","GET",undefined,signedIn.cookie)).status,403);
    assert.equal((await login(initData(tg))).status,403);
    assert.equal((await contact({from:other,phone})).status,200);
    assert.equal(await linked(investorId),String(other));
    const rebound=await login(initData(other));
    assert.equal(rebound.status,200);assert.equal(rebound.data.role,"investor");
    assert.equal((await login(initData(tg))).status,403);

    // An investor provisioned with neither a Telegram id nor a phone gets a phone later, then binds like any other.
    const bare=await session("investor");
    const barePhone="+998"+String(Math.floor(Math.random()*1e9)).padStart(9,"0");
    const fourth=tg+3;
    const bareListed=(await call("/api/admin/investors","GET",undefined,admin.cookie)).data.items.find(i=>i.account_id===bare.id);
    assert.equal(bareListed.sign_in,"none");assert.equal(bareListed.phone_masked,null);
    assert.equal((await call(accounts,"POST",{action:"setSignInPhone",accountId:bare.id,phone:barePhone},seller.cookie)).status,403);
    assert.equal((await call(accounts,"POST",{action:"setSignInPhone",accountId:bare.id,phone:"12345"},admin.cookie)).status,400);
    assert.equal((await call(accounts,"POST",{action:"setSignInPhone",accountId:bare.id,phone},admin.cookie)).status,409);
    assert.equal((await call(accounts,"POST",{action:"setSignInPhone",accountId:seller.id,phone:barePhone},admin.cookie)).status,404);
    assert.equal((await call(accounts,"POST",{action:"setSignInPhone",accountId:bare.id,phone:barePhone},admin.cookie)).status,201);
    assert.equal((await call(accounts,"POST",{action:"setSignInPhone",accountId:bare.id,phone:barePhone},admin.cookie)).status,409);
    assert.equal((await call(accounts,"POST",{action:"setSignInPhone",accountId:investorId,phone:"+998"+String(Math.floor(Math.random()*1e9)).padStart(9,"0")},admin.cookie)).status,409);
    assert.equal((await contact({from:fourth,phone:barePhone})).status,200);
    assert.equal(await linked(bare.id),String(fourth));
    assert.equal((await login(initData(fourth))).data.role,"investor");
  }finally{await pool.end();}
});
