import { NextResponse } from "next/server";
import {variantImage,type OptionGroup,type OptionSelection} from "../../../lib/catalog-options";
import {approvedImageUrl} from "../../../lib/server/catalog-media";
import { database,configuredStoreId } from "../../../lib/server/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(){
  try {
    const storeId=configuredStoreId();
    const {rows}=await database().query(
      "SELECT p.id,p.name,p.category,p.description,p.image_url,p.option_groups,v.id AS variant_id,v.color,v.storage_label,v.option_values,v.image_url AS variant_image_url,v.price_uzs::text,v.quantity>0 AS in_stock FROM products p JOIN variants v ON v.product_id=p.id AND v.store_id=p.store_id WHERE p.store_id=$1 AND p.published=true AND v.active=true ORDER BY p.name,p.id,v.color,v.id LIMIT 200",
      [storeId]
    );
    return NextResponse.json({items:rows.map(r=>{
      const groups=(r.option_groups as OptionGroup[]).map(g=>({...g,values:g.values.map(v=>({...v,imageUrl:v.imageUrl&&approvedImageUrl(v.imageUrl)?v.imageUrl:null}))}));
      const selection=r.option_values as OptionSelection;
      const image=variantImage(groups,selection,r.variant_image_url&&approvedImageUrl(r.variant_image_url)?r.variant_image_url:null,r.image_url&&approvedImageUrl(r.image_url)?r.image_url:null);
      const {variant_image_url:unused,...rest}=r;
      return {...rest,option_groups:groups,image_url:image};
    })},{headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:"Katalog vaqtincha mavjud emas"},{status:503});
  }
}
