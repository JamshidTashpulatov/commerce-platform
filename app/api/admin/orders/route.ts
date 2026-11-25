import { NextResponse } from "next/server";
import { database,configuredStoreId } from "../../../../lib/server/db";
import { requireStoreRole } from "../../../../lib/server/auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
  try {
    const storeId=configuredStoreId();
    const member=await requireStoreRole(storeId,["owner","admin"]);
    if(!member)return NextResponse.json({error:"Access denied"},{status:403});
    const {rows}=await database().query(
      "SELECT o.id,o.status,o.currency,o.created_at,COALESCE(SUM(i.unit_price_uzs::numeric*i.quantity),0)::text AS total_uzs FROM orders o LEFT JOIN order_items i ON i.store_id=o.store_id AND i.order_id=o.id WHERE o.store_id=$1 GROUP BY o.id ORDER BY o.created_at DESC LIMIT 100",
      [storeId]
    );
    return NextResponse.json({items:rows},{headers:{"Cache-Control":"private, no-store"}});
  }catch{
    return NextResponse.json({error:"Service unavailable"},{status:503});
  }
}
