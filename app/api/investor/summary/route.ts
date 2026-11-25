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
    if(!member)return NextResponse.json({error:"Access denied"},{status:403,headers});
    const {rows}=await database().query(`
       SELECT
       COALESCE(SUM(amount_uzs) FILTER(WHERE event_type='contribution'),0)::text AS contributions_uzs,
       COALESCE(SUM(amount_uzs) FILTER(WHERE event_type='withdrawal'),0)::text AS withdrawals_uzs,
       COALESCE(SUM(amount_uzs) FILTER(WHERE event_type='distribution'),0)::text AS recorded_distributions_uzs
       FROM investor_capital_events WHERE store_id=$1 AND investor_account_id=$2
    `,[storeId,member.account_id]);
    return NextResponse.json({currency:"UZS",...rows[0]},{headers});
  }catch{return NextResponse.json({error:"Service unavailable"},{status:503,headers});}
}
