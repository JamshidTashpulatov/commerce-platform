import { NextResponse } from "next/server";
import {approvedImageUrl} from "../../../lib/server/catalog-media";
import { database,configuredStoreId } from "../../../lib/server/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(){
  try {
    const storeId=configuredStoreId();
    const {rows}=await database().query(
      "SELECT p.id,p.name,p.category,p.description,p.image_url,v.id AS variant_id,v.color,v.storage_label,v.price_uzs::text,v.quantity>0 AS in_stock FROM products p JOIN variants v ON v.product_id=p.id AND v.store_id=p.store_id WHERE p.store_id=$1 AND p.published=true AND v.active=true ORDER BY p.name,p.id,v.color,v.id LIMIT 200",
      [storeId]
    );
    return NextResponse.json({items:rows.map(r=>({...r,image_url:typeof r.image_url==='string'&&approvedImageUrl(r.image_url)?r.image_url:null}))},{headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:"Katalog vaqtincha mavjud emas"},{status:503});
  }
}
