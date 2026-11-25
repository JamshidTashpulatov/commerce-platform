import { NextResponse } from "next/server";
import { database,configuredStoreId } from "../../../lib/server/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(){
  try {
    const storeId=configuredStoreId();
    const {rows}=await database().query(
      "SELECT p.id,p.name,p.category,p.description,v.id AS variant_id,v.color,v.price_uzs::text,v.quantity>0 AS in_stock FROM products p JOIN variants v ON v.product_id=p.id AND v.store_id=p.store_id WHERE p.store_id=$1 AND p.published=true AND v.active=true ORDER BY p.name,v.color LIMIT 200",
      [storeId]
    );
    return NextResponse.json({items:rows},{headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:"Catalog unavailable"},{status:503});
  }
}
