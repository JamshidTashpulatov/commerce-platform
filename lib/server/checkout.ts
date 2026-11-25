import "server-only";
import {createHmac,randomInt} from "node:crypto";
import {customerConfig} from "./customers";
import {lookupPhone,normalizedPhone,seal,fieldContext} from "./customer-crypto";
import {database,configuredStoreId} from "./db";
import {isUuid} from "./http";
import {parseLines,quoteLines,type QuotedLine} from "./cart";

export const checkoutEnabled=()=>process.env.WEBSITE_CHECKOUT_ENABLED==="true"&&process.env.CUSTOMER_RECORDS_ENABLED==="true";

// Limits for the unauthenticated form, per rolling hour.
export const LIMITS={ip:10,phone:5};
const REF_ALPHABET="0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export type CheckoutInput={requestKey:string;channel:"cart"|"one_click";lines:{variantId:string;quantity:number;expectedPrice:string|null}[];
  name:string;phone:string|null;useTelegramPhone:boolean;comment:string|null};
export type CheckoutResult=
  |{status:201|200;body:{reference:string;orders:number;total:string;repeated?:boolean}}
  |{status:400|403|409|429|503;body:{error:string;code?:string;lines?:QuotedLine[]}};

const clean=(v:unknown,max:number)=>typeof v==="string"?v.replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max+1):"";

/** Validate an untrusted checkout body. Returns null when anything is off. */
export function parseCheckout(body:Record<string,unknown>|null):CheckoutInput|null{
  if(!body)return null;
  if(typeof body.website==="string"&&body.website.length)return null; // honeypot: humans never see this field
  if(!isUuid(body.requestKey)||(body.channel!=="cart"&&body.channel!=="one_click"))return null;
  const lines=parseLines(body.lines,20,10);
  if(!lines||(body.channel==="one_click"&&lines.length!==1))return null;
  const name=clean(body.name,80);
  if(name.length<2||name.length>80||!/\p{L}/u.test(name))return null;
  const useTelegramPhone=body.useTelegramPhone===true;
  let phone:string|null=null;
  if(!useTelegramPhone){
    phone=normalizedPhone(body.phone);
    if(!phone||!/^\+998\d{9}$/.test(phone))return null;
  }
  const comment=clean(body.comment,500);
  if(comment.length>500)return null;
  return {requestKey:body.requestKey.toLowerCase(),channel:body.channel,lines,name,phone,useTelegramPhone,comment:comment||null};
}

export function clientAddress(request:Request){
  // The first X-Forwarded-For entry is set by the hosting edge (Vercel). Locally it may be absent.
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim()||request.headers.get("x-real-ip")||"unknown";
}

const reference=()=>"MT-"+Array.from({length:8},()=>REF_ALPHABET[randomInt(REF_ALPHABET.length)]).join("");

/**
 * Create one order request per line, sharing one checkout and its encrypted
 * contact details, in a single transaction. Prices come from the database.
 * Nothing touches stock, payments, receipts, funding or other finance tables.
 */
export async function submitCheckout(input:CheckoutInput,address:string,telegram:{accountId:string;phone:string|null}|null):Promise<CheckoutResult>{
  const storeId=configuredStoreId();
  const keys=customerConfig();
  const phone=input.useTelegramPhone?telegram?.phone??null:input.phone;
  if(!phone)return {status:400,body:{error:"Telefon raqamini kiriting"}};
  const phoneLookup=lookupPhone(keys.lookup,storeId,phone);
  const ipBucket="ip:"+createHmac("sha256",keys.lookup).update(JSON.stringify([storeId,"ip",address])).digest("hex");
  const phoneBucket="phone:"+phoneLookup;
  const linesKey=JSON.stringify(input.lines.map(l=>[l.variantId,l.quantity]).sort());

  const client=await database().connect();
  try{
    await client.query("BEGIN");
    // Same request key again: return the original result if it is the same request.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[storeId+input.requestKey]);
    const existing=await client.query(
      `SELECT c.reference,c.phone_lookup,c.channel,json_agg(json_build_array(i.variant_id,i.quantity)) AS lines,
         sum(i.unit_price_uzs::numeric*i.quantity)::text AS total,count(*)::int AS orders
       FROM website_checkouts c JOIN orders o ON o.store_id=c.store_id AND o.website_checkout_id=c.id
       JOIN order_items i ON i.store_id=o.store_id AND i.order_id=o.id
       WHERE c.store_id=$1 AND c.request_key=$2 GROUP BY c.id`,[storeId,input.requestKey]);
    if(existing.rowCount){
      const e=existing.rows[0];
      await client.query("ROLLBACK");
      const same=e.phone_lookup===phoneLookup&&e.channel===input.channel&&JSON.stringify((e.lines as [string,number][]).sort())===linesKey;
      return same?{status:200,body:{reference:e.reference,orders:e.orders,total:e.total,repeated:true}}
        :{status:409,body:{error:"Bu so‘rov allaqachon yuborilgan",code:"request_key_used"}};
    }

    // Rate limits per client address and per phone, counted under a lock so parallel requests cannot slip through.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1)),pg_advisory_xact_lock(hashtext($2))",[storeId+ipBucket,storeId+phoneBucket]);
    await client.query("DELETE FROM website_checkout_attempts WHERE store_id=$1 AND created_at<now()-interval '1 day'",[storeId]);
    const counts=await client.query(
      `SELECT bucket,count(*)::int AS n FROM website_checkout_attempts WHERE store_id=$1 AND bucket=ANY($2) AND created_at>now()-interval '1 hour' GROUP BY bucket`,
      [storeId,[ipBucket,phoneBucket]]);
    const n=(b:string)=>counts.rows.find(r=>r.bucket===b)?.n??0;
    if(n(ipBucket)>=LIMITS.ip||n(phoneBucket)>=LIMITS.phone){
      await client.query("ROLLBACK");
      return {status:429,body:{error:"So‘rovlar juda ko‘p. Bir soatdan keyin qayta urinib ko‘ring yoki Telegram orqali yozing.",code:"rate_limited"}};
    }
    await client.query("INSERT INTO website_checkout_attempts(store_id,bucket) VALUES($1,$2),($1,$3)",[storeId,ipBucket,phoneBucket]);
    // Commit the attempt even if the request below is rejected, so probing counts too.
    await client.query("COMMIT");
    await client.query("BEGIN");

    const quoted=await quoteLines(client,storeId,input.lines,true);
    if(quoted.some(l=>!l.available)){
      await client.query("ROLLBACK");
      return {status:409,body:{error:"Ba’zi mahsulotlar endi sotuvda yo‘q",code:"unavailable",lines:quoted}};
    }
    if(input.lines.some((l,i)=>l.expectedPrice!==null&&l.expectedPrice!==quoted[i].unitPrice)){
      await client.query("ROLLBACK");
      return {status:409,body:{error:"Narx o‘zgardi. Yangi narxni tekshirib, qayta yuboring.",code:"price_changed",lines:quoted}};
    }

    let checkout:{id:string;reference:string}|null=null;
    for(let attempt=0;attempt<4&&!checkout;attempt++){
      const ref=reference();
      const id=(await client.query("SELECT gen_random_uuid() AS id")).rows[0].id as string;
      const inserted=await client.query(
        `INSERT INTO website_checkouts(id,store_id,reference,request_key,channel,name_cipher,phone_cipher,phone_lookup,comment_cipher,telegram_account_id,line_count)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(store_id,reference) DO NOTHING RETURNING id,reference`,
        [id,storeId,ref,input.requestKey,input.channel,
         seal(keys.encryption,input.name,fieldContext(storeId,id,"name")),
         seal(keys.encryption,phone,fieldContext(storeId,id,"phone")),phoneLookup,
         input.comment?seal(keys.encryption,input.comment,fieldContext(storeId,id,"comment")):null,
         telegram?.accountId??null,input.lines.length]);
      if(inserted.rowCount)checkout=inserted.rows[0];
    }
    if(!checkout){await client.query("ROLLBACK");return {status:503,body:{error:"So‘rovni saqlab bo‘lmadi"}};}
    let total=BigInt(0);
    for(const line of quoted){
      const order=await client.query("INSERT INTO orders(store_id,source,website_checkout_id) VALUES($1,'website',$2) RETURNING id",[storeId,checkout.id]);
      await client.query("INSERT INTO order_items(store_id,order_id,variant_id,quantity,unit_price_uzs) VALUES($1,$2,$3,$4,$5)",
        [storeId,order.rows[0].id,line.variantId,line.quantity,line.unitPrice]);
      await client.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,NULL,'website_request_created','order',$2)",[storeId,order.rows[0].id]);
      total+=BigInt(line.unitPrice)*BigInt(line.quantity);
    }
    await client.query("COMMIT");
    return {status:201,body:{reference:checkout.reference,orders:quoted.length,total:total.toString()}};
  }catch(e){
    await client.query("ROLLBACK").catch(()=>{});
    // A concurrent request with the same key won the race: the caller can retry and get the stored result.
    if((e as {code?:string}).code==="23505")return {status:409,body:{error:"So‘rov hozir qayta ishlanmoqda. Bir necha soniyadan keyin qayta urinib ko‘ring.",code:"in_progress"}};
    return {status:503,body:{error:"Buyurtma vaqtincha qabul qilinmadi"}};
  }finally{client.release();}
}
