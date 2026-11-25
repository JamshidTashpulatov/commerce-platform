import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../../lib/server/db";
import {requireStoreRole} from "../../../../../lib/server/auth";
import {sameOrigin,smallJson,privateHeaders} from "../../../../../lib/server/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
export async function GET(){
 try{
 const store=configuredStoreId();
 if(!await requireStoreRole(store,["owner","admin"]))return reply({error:"Ruxsat yo‘q"},403);
 const r=await database().query("SELECT allow_peer_portfolios FROM investor_access_settings WHERE store_id=$1",[store]);
 return reply({allowPeerPortfolios:r.rows[0]?.allow_peer_portfolios===true});
 }catch{return reply({error:"Sozlamalarni yuklab bo‘lmadi"},503);}
}
export async function PUT(request:Request){
 if(!sameOrigin(request))return reply({error:"Ruxsat yo‘q"},403);
 const b=await smallJson(request);if(typeof b?.allowPeerPortfolios!=="boolean")return reply({error:"Sozlamani tekshiring"},400);
 try{
 const store=configuredStoreId();
 const member=await requireStoreRole(store,["owner","admin"]);if(!member)return reply({error:"Ruxsat yo‘q"},403);
 const c=await database().connect();
 try{
 await c.query("BEGIN");
 await c.query("INSERT INTO investor_access_settings(store_id,allow_peer_portfolios) VALUES($1,$2) ON CONFLICT(store_id) DO UPDATE SET allow_peer_portfolios=EXCLUDED.allow_peer_portfolios,updated_at=now()",[store,b.allowPeerPortfolios]);
 await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,$3,'store',$1)",[store,member.account_id,b.allowPeerPortfolios?"peer_portfolios_enabled":"peer_portfolios_disabled"]);
 await c.query("COMMIT");return reply({allowPeerPortfolios:b.allowPeerPortfolios});
 }catch{await c.query("ROLLBACK");return reply({error:"Sozlama saqlanmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
