import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../lib/server/db";
import {requireStoreRole} from "../../../../lib/server/auth";
import {privateHeaders} from "../../../../lib/server/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
export async function GET(){
 try{
 const store=configuredStoreId();const member=await requireStoreRole(store,["investor"]);
 if(!member)return reply({error:"Ruxsat yo‘q"},403);
 const c=await database().connect();
 try{
 await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 const settings=await c.query("SELECT allow_peer_portfolios FROM investor_access_settings WHERE store_id=$1",[store]);
 if(settings.rows[0]?.allow_peer_portfolios!==true){await c.query("COMMIT");return reply({enabled:false,items:[]});}
 const {rows}=await c.query(`SELECT m.account_id,COALESCE(p.display_name,'Investor '||left(m.account_id::text,8)) AS name,
 (COALESCE(e.contributed,0)-COALESCE(e.withdrawn,0))::text AS principal,
 COALESCE(a.allocated,0)::text AS allocated,COALESCE(a.returned,0)::text AS returned,COALESCE(a.outstanding,0)::text AS outstanding,
 (COALESCE(e.contributed,0)-COALESCE(e.withdrawn,0)-COALESCE(a.outstanding,0))::text AS available,
 COALESCE(e.distributed,0)::text AS distributed
 FROM memberships m LEFT JOIN investor_profiles p ON p.store_id=m.store_id AND p.account_id=m.account_id
 LEFT JOIN LATERAL (SELECT SUM(amount_uzs) FILTER(WHERE event_type='contribution') AS contributed,SUM(amount_uzs) FILTER(WHERE event_type='withdrawal') AS withdrawn,SUM(amount_uzs) FILTER(WHERE event_type='distribution') AS distributed FROM investor_capital_events WHERE store_id=m.store_id AND investor_account_id=m.account_id) e ON true
 LEFT JOIN LATERAL (SELECT SUM(amount_uzs) AS allocated,SUM(returned_uzs) AS returned,SUM(outstanding_uzs) AS outstanding FROM investor_funding_balances WHERE store_id=m.store_id AND investor_account_id=m.account_id) a ON true
 WHERE m.store_id=$1 AND m.role='investor' AND m.account_id<>$2 ORDER BY name,m.account_id LIMIT 200`,[store,member.account_id]);
 await c.query("COMMIT");return reply({enabled:true,items:rows});
 }catch{await c.query("ROLLBACK");return reply({error:"Portfoliolarni yuklab bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
