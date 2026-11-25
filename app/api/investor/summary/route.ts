import { NextResponse } from "next/server";
import { database,configuredStoreId } from "../../../../lib/server/db";
import { requireStoreRole } from "../../../../lib/server/auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function GET(){
  try{
    const storeId=configuredStoreId();
    const member=await requireStoreRole(storeId,["investor"]);
    if(!member)return NextResponse.json({error:"Ruxsat yo‘q"},{status:403,headers});
    const {rows}=await database().query(`
       SELECT
       COALESCE(SUM(amount_uzs) FILTER(WHERE event_type='contribution'),0)::text AS contributions_uzs,
       COALESCE(SUM(amount_uzs) FILTER(WHERE event_type='withdrawal'),0)::text AS withdrawals_uzs,
       COALESCE(SUM(amount_uzs) FILTER(WHERE event_type='distribution'),0)::text AS recorded_distributions_uzs
       FROM investor_capital_events WHERE store_id=$1 AND investor_account_id=$2
    `,[storeId,member.account_id]);
    const allocations=await database().query("SELECT a.order_id,a.amount_uzs::text,o.sale_status,o.created_at FROM order_funding_allocations a JOIN orders o ON o.store_id=a.store_id AND o.id=a.order_id WHERE a.store_id=$1 AND a.investor_account_id=$2 ORDER BY o.created_at DESC",[storeId,member.account_id]);
    const allocated=allocations.rows.reduce((s,r)=>s+BigInt(r.amount_uzs),BigInt(0));
    return NextResponse.json({currency:"UZS",...rows[0],allocated_uzs:allocated.toString(),available_uzs:(BigInt(rows[0].contributions_uzs)-BigInt(rows[0].withdrawals_uzs)-allocated).toString(),allocations:allocations.rows},{headers});
  }catch{return NextResponse.json({error:"Xizmat vaqtincha ishlamayapti"},{status:503,headers});}
}
