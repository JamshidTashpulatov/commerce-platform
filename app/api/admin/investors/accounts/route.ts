import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../../lib/server/db";
import {requireStoreRole} from "../../../../../lib/server/auth";
import {sameOrigin,smallJson,privateHeaders} from "../../../../../lib/server/http";
export const runtime="nodejs";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Ruxsat yo‘q"},403);
 const b=await smallJson(request);
 const name=typeof b?.name==="string"?b.name.trim():"";
 const telegramId=typeof b?.telegramId==="string"?b.telegramId.trim():"";
 if(name.length<2||name.length>120||!/^[1-9][0-9]{0,15}$/.test(telegramId)||BigInt(telegramId)>BigInt("4503599627370495"))return reply({error:"Investor nomi va Telegram ID raqamini tekshiring"},400);
 try{
 const store=configuredStoreId();
 const member=await requireStoreRole(store,["owner","admin"]);if(!member)return reply({error:"Ruxsat yo‘q"},403);
 const c=await database().connect();
 try{
 await c.query("BEGIN");
 const a=await c.query("INSERT INTO accounts(telegram_user_id) VALUES($1) ON CONFLICT(telegram_user_id) DO NOTHING RETURNING id",[telegramId]);
 if(!a.rowCount){await c.query("ROLLBACK");return reply({error:"Bu Telegram hisobiga bog‘langan akkaunt mavjud. Administrator tekshirishi kerak."},409);}
 const id=a.rows[0].id;
 await c.query("INSERT INTO memberships(store_id,account_id,role) VALUES($1,$2,'investor')",[store,id]);
 await c.query("INSERT INTO investor_profiles(store_id,account_id,display_name) VALUES($1,$2,$3)",[store,id,name]);
 await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'investor_created','account',$3)",[store,member.account_id,id]);
 await c.query("COMMIT");return reply({id,name},201);
 }catch{await c.query("ROLLBACK");return reply({error:"Investor hisobini yaratib bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
