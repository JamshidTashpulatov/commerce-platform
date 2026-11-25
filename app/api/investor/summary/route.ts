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
    const c=await database().connect();
    try{
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const {rows}=await c.query(`
       SELECT
       COALESCE(SUM(amount_uzs) FILTER(WHERE event_type='contribution'),0)::text AS contributions_uzs,
       COALESCE(SUM(amount_uzs) FILTER(WHERE event_type='withdrawal'),0)::text AS withdrawals_uzs,
       COALESCE(SUM(amount_uzs) FILTER(WHERE event_type='distribution'),0)::text AS recorded_distributions_uzs
       FROM investor_capital_events WHERE store_id=$1 AND investor_account_id=$2
    `,[storeId,member.account_id]);
    const allocations=await c.query("SELECT a.order_id,a.amount_uzs::text,a.returned_uzs::text,a.outstanding_uzs::text,o.sale_status,o.created_at FROM investor_funding_balances a JOIN orders o ON o.store_id=a.store_id AND o.id=a.order_id WHERE a.store_id=$1 AND a.investor_account_id=$2 ORDER BY o.created_at DESC",[storeId,member.account_id]);
    const allocated=allocations.rows.reduce<bigint>((s,r)=>s+BigInt(r.amount_uzs),BigInt(0));
    const returned=allocations.rows.reduce<bigint>((s,r)=>s+BigInt(r.returned_uzs),BigInt(0));
    const outstanding=allocated-returned;
    const earnings=await c.query("SELECT COALESCE(SUM(profit_uzs),0)::text AS profit FROM active_monthly_allocations WHERE store_id=$1 AND investor_account_id=$2",[storeId,member.account_id]);
    await c.query("COMMIT");
    return NextResponse.json({currency:"USD",received_profit_uzs:earnings.rows[0].profit,...rows[0],allocated_uzs:allocated.toString(),returned_uzs:returned.toString(),outstanding_uzs:outstanding.toString(),available_uzs:(BigInt(rows[0].contributions_uzs)-BigInt(rows[0].withdrawals_uzs)-outstanding).toString(),allocations:allocations.rows},{headers});
    }catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
  }catch{return NextResponse.json({error:"Xizmat vaqtincha ishlamayapti"},{status:503,headers});}
}
