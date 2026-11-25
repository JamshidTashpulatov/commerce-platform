import {NextResponse} from "next/server";
import {randomUUID} from "node:crypto";
import {database,configuredStoreId} from "../../../../lib/server/db";
import {requireStoreRole} from "../../../../lib/server/auth";
import {sameOrigin,smallJson,privateHeaders} from "../../../../lib/server/http";
import {customerConfig,customerSummary} from "../../../../lib/server/customers";
import {normalizedPhone,lookupPhone,seal,fieldContext} from "../../../../lib/server/customer-crypto";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Ruxsat yo‘q"},403);
 const b=await smallJson(request);const phone=normalizedPhone(b?.phone);
 if(!b||!phone||!["find","create"].includes(String(b.action)))return reply({error:"Telefon raqamini xalqaro formatda kiriting"},400);
 const name=typeof b.name==="string"?b.name.trim():"";
 const passport=typeof b.passport==="string"?b.passport.trim().toUpperCase():"";
 if(b.action==="create"&&(name.length<2||name.length>120||(passport&&!/^[A-Z0-9]{6,20}$/.test(passport))))return reply({error:"Ism yoki hujjat raqamini tekshiring"},400);
 try{
 const store=configuredStoreId();const member=await requireStoreRole(store,["owner","admin","seller"]);if(!member)return reply({error:"Ruxsat yo‘q"},403);
 const keys=customerConfig();const hash=lookupPhone(keys.lookup,store,phone);
 const c=await database().connect();
 try{
 await c.query("BEGIN");
 if(b.action==="find"){
 const result=await c.query("SELECT id,name_cipher,phone_cipher,passport_cipher IS NOT NULL AS has_passport FROM customers WHERE store_id=$1 AND phone_lookup=$2",[store,hash]);
 const item=result.rows[0]?customerSummary(result.rows[0],store,keys.encryption):null;
 await c.query("COMMIT");return reply({customer:item});
 }
 const id=randomUUID();
 const result=await c.query("INSERT INTO customers(id,store_id,name_cipher,phone_cipher,phone_lookup,passport_cipher,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(store_id,phone_lookup) DO NOTHING RETURNING id,name_cipher,phone_cipher,passport_cipher IS NOT NULL AS has_passport",[id,store,seal(keys.encryption,name,fieldContext(store,id,"name")),seal(keys.encryption,phone,fieldContext(store,id,"phone")),hash,passport?seal(keys.encryption,passport,fieldContext(store,id,"passport")):null,member.account_id]);
 if(!result.rowCount){await c.query("ROLLBACK");return reply({error:"Ushbu telefon raqamli mijoz mavjud. Qidiruvdan foydalaning."},409);}
 await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'customer_created','customer',$3)",[store,member.account_id,id]);
 const item=customerSummary(result.rows[0],store,keys.encryption);await c.query("COMMIT");return reply({customer:item},201);
 }catch{await c.query("ROLLBACK");return reply({error:"Mijoz ma’lumotlarini saqlab bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Mijozlar moduli sozlanmagan yoki vaqtincha ishlamayapti"},503);}
}
