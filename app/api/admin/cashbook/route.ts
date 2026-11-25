import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../lib/server/db";
import {requireStoreRole} from "../../../../lib/server/auth";
import {privateHeaders} from "../../../../lib/server/http";
import {validDate} from "../../../../lib/installment-schedule";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
export async function GET(request:Request){
 const q=new URL(request.url).searchParams;const from=q.get("from"),to=q.get("to");
 if(!validDate(from)||!validDate(to)||from>to||from<"2000-01-01"||to>"2099-12-31"||(Date.parse(to)-Date.parse(from))/86400000>3660)return reply({error:"Hisobot davrini tekshiring"},400);
 try{
 const store=configuredStoreId();if(!await requireStoreRole(store,["owner","admin"]))return reply({error:"Ruxsat yo‘q"},403);
 const c=await database().connect();
 try{
 await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 const values=[store,from,to];
 const totals=await c.query(`SELECT COALESCE(SUM(amount_uzs) FILTER(WHERE movement_date<$2::date),0)::text AS opening_uzs,
 COALESCE(SUM(amount_uzs) FILTER(WHERE movement_date BETWEEN $2::date AND $3::date AND amount_uzs>0),0)::text AS incoming_uzs,
 COALESCE(-SUM(amount_uzs) FILTER(WHERE movement_date BETWEEN $2::date AND $3::date AND amount_uzs<0),0)::text AS outgoing_uzs,
 COALESCE(SUM(amount_uzs),0)::text AS closing_uzs
 FROM recorded_fund_movements WHERE store_id=$1 AND movement_date<=$3::date`,values);
 const groups=await c.query("SELECT kind,COUNT(*)::int AS count,SUM(amount_uzs)::text AS amount_uzs FROM recorded_fund_movements WHERE store_id=$1 AND movement_date BETWEEN $2::date AND $3::date GROUP BY kind ORDER BY kind",values);
 const entries=await c.query("SELECT source_id,kind,amount_uzs::text,movement_date::text,recorded_at FROM recorded_fund_movements WHERE store_id=$1 AND movement_date BETWEEN $2::date AND $3::date ORDER BY movement_date DESC,recorded_at DESC,kind,source_id LIMIT 201",values);
 const reviews=await c.query(`SELECT x.id,x.order_id,x.reason,x.opened_at,x.resolved_at,x.resolution,
 COALESCE(m.amount_uzs,r.amount_uzs)::text AS amount_uzs FROM receipt_reviews x
 LEFT JOIN order_manual_receipts m ON m.store_id=x.store_id AND m.id=x.manual_id
 LEFT JOIN installment_receipts r ON r.store_id=x.store_id AND r.id=x.monthly_id
 WHERE x.store_id=$1 AND (x.resolved_at IS NULL OR (x.resolved_at AT TIME ZONE 'Asia/Tashkent')::date BETWEEN $2 AND $3)
 ORDER BY (x.resolved_at IS NULL) DESC,x.opened_at DESC`,values);
 await c.query("COMMIT");return reply({from,to,reviews:reviews.rows,currency:"USD",...totals.rows[0],groups:groups.rows,entries:entries.rows.slice(0,200),truncated:entries.rows.length>200,complete:false});
 }catch{await c.query("ROLLBACK");return reply({error:"Kassa hisobotini yuklab bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
