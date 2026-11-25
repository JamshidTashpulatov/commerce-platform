import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../lib/server/db";
import {requireStoreRole} from "../../../../lib/server/auth";
import {isUuid,privateHeaders} from "../../../../lib/server/http";
import {validDate} from "../../../../lib/installment-schedule";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
export async function GET(request:Request){
 const q=new URL(request.url).searchParams;
 const from=q.get("from"),to=q.get("to"),target=q.get("accountId");
 if(!validDate(from)||!validDate(to)||from>to||from<"2000-01-01"||to>"2099-12-31"||(Date.parse(to)-Date.parse(from))/86400000>3660||(target!==null&&!isUuid(target)))return reply({error:"Hisobot davrini tekshiring"},400);
 try{
 const store=configuredStoreId();
 const member=await requireStoreRole(store,target?["owner","admin"]:["investor"]);
 if(!member)return reply({error:"Ruxsat yo‘q"},403);
 const account=target??member.account_id;
 const c=await database().connect();
 try{
 await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 const investor=await c.query("SELECT 1 FROM memberships WHERE store_id=$1 AND account_id=$2 AND role='investor'",[store,account]);
 if(!investor.rowCount){await c.query("ROLLBACK");return reply({error:"Investor topilmadi"},404);}
 const values=[store,account,from,to];
 const filter="store_id=$1 AND investor_account_id=$2 AND created_at >= ($3::date::timestamp AT TIME ZONE 'Asia/Tashkent') AND created_at < (($4::date+1)::timestamp AT TIME ZONE 'Asia/Tashkent')";
 const months=await c.query(`SELECT to_char(created_at AT TIME ZONE 'Asia/Tashkent','YYYY-MM') AS month,
 COALESCE(SUM(amount_uzs) FILTER(WHERE event_type='contribution'),0)::text AS contributed,
 COALESCE(SUM(amount_uzs) FILTER(WHERE event_type='withdrawal'),0)::text AS withdrawn,
 COALESCE(SUM(amount_uzs) FILTER(WHERE event_type='distribution'),0)::text AS distributed
 FROM investor_capital_events WHERE ${filter} GROUP BY 1 ORDER BY 1`,values);
 const entries=await c.query(`SELECT id,event_type,amount_uzs::text,created_at FROM investor_capital_events WHERE ${filter} ORDER BY created_at DESC,id DESC LIMIT 201`,values);
 await c.query("COMMIT");
 return reply({from,to,months:months.rows,entries:entries.rows.slice(0,200),truncated:entries.rows.length>200});
 }catch{await c.query("ROLLBACK");return reply({error:"Hisobotni yuklab bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
