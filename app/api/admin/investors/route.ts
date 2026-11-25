import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../lib/server/db";
import {requireStoreRole} from "../../../../lib/server/auth";
import {isUuid,sameOrigin,smallJson,privateHeaders} from "../../../../lib/server/http";
import {maskedSignInPhone} from "../../../../lib/server/sign-in-phone";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
export async function GET(){
 try{
 const store=configuredStoreId();if(!await requireStoreRole(store,["owner","admin"]))return reply({error:"Ruxsat yo‘q"},403);
 const {rows}=await database().query(`SELECT m.account_id,COALESCE(p.display_name,'Investor '||left(m.account_id::text,8)) AS name,
 COALESCE(e.contributed,0)::text AS contributed,COALESCE(e.withdrawn,0)::text AS withdrawn,COALESCE(e.distributed,0)::text AS distributed,
 COALESCE(a.allocated,0)::text AS allocated,COALESCE(a.returned,0)::text AS returned,COALESCE(a.outstanding,0)::text AS outstanding,(COALESCE(e.contributed,0)-COALESCE(e.withdrawn,0)-COALESCE(a.outstanding,0))::text AS available,
 s.phone_cipher,(acc.telegram_user_id IS NOT NULL) AS telegram_linked,(s.account_id IS NOT NULL) AS by_phone
 FROM memberships m LEFT JOIN investor_profiles p ON p.store_id=m.store_id AND p.account_id=m.account_id
 JOIN accounts acc ON acc.id=m.account_id
 LEFT JOIN account_sign_in_phones s ON s.store_id=m.store_id AND s.account_id=m.account_id
 LEFT JOIN LATERAL (SELECT SUM(amount_uzs) FILTER(WHERE event_type='contribution') AS contributed,SUM(amount_uzs) FILTER(WHERE event_type='withdrawal') AS withdrawn,SUM(amount_uzs) FILTER(WHERE event_type='distribution') AS distributed FROM investor_capital_events WHERE store_id=m.store_id AND investor_account_id=m.account_id) e ON true
 LEFT JOIN LATERAL (SELECT SUM(amount_uzs) AS allocated,SUM(returned_uzs) AS returned,SUM(outstanding_uzs) AS outstanding FROM investor_funding_balances WHERE store_id=m.store_id AND investor_account_id=m.account_id) a ON true
 WHERE m.store_id=$1 AND m.role='investor' ORDER BY name LIMIT 200`,[store]);
 // The sign-in phone leaves the server masked only; sign_in tells the admin whether Telegram is linked yet.
 const items=rows.map(({phone_cipher,telegram_linked,by_phone,...row})=>({...row,
  phone_masked:phone_cipher?maskedSignInPhone(store,row.account_id,phone_cipher):null,
  sign_in:telegram_linked?"linked":by_phone?"pending":"none",by_phone}));
 return reply({items,enabled:process.env.INVESTOR_FUNDING_ENABLED==="true"});
 }catch{return reply({error:"Investorlarni yuklab bo‘lmadi"},503);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Ruxsat yo‘q"},403);
 const b=await smallJson(request);
 if(!b||!isUuid(b.accountId)||!isUuid(b.key)||typeof b.amount!=="string"||!/^[1-9][0-9]{0,8}$/.test(b.amount)||!["contribution","withdrawal","distribution"].includes(String(b.type)))return reply({error:"Ma’lumotlarni tekshiring"},400);
 try{
 const store=configuredStoreId();const member=await requireStoreRole(store,["owner","admin"]);if(!member)return reply({error:"Ruxsat yo‘q"},403);
 if(process.env.INVESTOR_FUNDING_ENABLED!=="true")return reply({error:"Moliyalashtirish hali yoqilmagan"},503);
 const c=await database().connect();
 try{
 await c.query("BEGIN");
 const fail=async(error:string,status=409)=>{await c.query("ROLLBACK");return reply({error},status);};
 const lock=await c.query("SELECT role FROM memberships WHERE store_id=$1 AND account_id=$2 FOR UPDATE",[store,b.accountId]);
 if(lock.rows[0]?.role!=="investor")return await fail("Investor topilmadi",404);
 const duplicate=await c.query("SELECT id,investor_account_id,event_type,amount_uzs::text FROM investor_capital_events WHERE store_id=$1 AND idempotency_key=$2",[store,b.key]);
 if(duplicate.rowCount){const d=duplicate.rows[0];await c.query("ROLLBACK");return d.investor_account_id===String(b.accountId).toLowerCase()&&d.event_type===b.type&&d.amount_uzs===b.amount?reply({id:d.id,repeated:true}):reply({error:"So‘rov kaliti band"},409);}
 if(b.type==="withdrawal"){
 const available=await c.query("SELECT (COALESCE((SELECT SUM(CASE event_type WHEN 'contribution' THEN amount_uzs WHEN 'withdrawal' THEN -amount_uzs ELSE 0 END) FROM investor_capital_events WHERE store_id=$1 AND investor_account_id=$2),0)-COALESCE((SELECT SUM(outstanding_uzs) FROM investor_funding_balances WHERE store_id=$1 AND investor_account_id=$2),0))::text AS value",[store,b.accountId]);
 if(BigInt(b.amount)>BigInt(available.rows[0].value))return await fail("Bo‘sh kapital yetarli emas");
 }
 const result=await c.query("INSERT INTO investor_capital_events(store_id,investor_account_id,event_type,amount_uzs,idempotency_key) VALUES($1,$2,$3,$4,$5) ON CONFLICT(store_id,idempotency_key) DO NOTHING RETURNING id",[store,b.accountId,b.type,b.amount,b.key]);
 if(!result.rowCount)return await fail("Takroriy so‘rov");
 await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,$3,'investor_capital_event',$4)",[store,member.account_id,"investor_"+b.type,result.rows[0].id]);
 await c.query("COMMIT");return reply({id:result.rows[0].id},201);
 }catch{await c.query("ROLLBACK");return reply({error:"Qaydni saqlab bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
