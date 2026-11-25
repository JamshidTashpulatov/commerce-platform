import { NextResponse } from "next/server";
import {variantImage,type OptionGroup,type OptionSelection} from "../../../lib/catalog-options";
import {approvedImageUrl} from "../../../lib/server/catalog-media";
import { database,configuredStoreId } from "../../../lib/server/db";
import {isUuid} from "../../../lib/server/http";
import {productModel} from "../../../lib/storefront";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request:Request){
  try {
    const storeId=configuredStoreId();
    const params=new URL(request.url).searchParams;
    const after=params.get("after");
    const category=params.get("category") || null;
    const query=params.get("q")?.trim() || null;
    const model=params.get("model")?.trim() || null;
    if (model && model.length>200) return NextResponse.json({error:"Qidiruv parametrlarini tekshiring"},{status:400});
    // Sort key: newest first by default (negative creation time), the lowest price for cheapest
    // first, its negative for dearest first, 0 for name order.
    // Name and id break ties, so the cursor (a product id) stays a stable keyset position.
    const sort=params.get("sort") || "new";
    if (!["new","name","price_asc","price_desc"].includes(sort)) {
      return NextResponse.json({error:"Qidiruv parametrlarini tekshiring"},{status:400});
    }
    if ((after!==null && !isUuid(after)) || (query && query.length>200) || (category && category.length>200)) {
      return NextResponse.json({error:"Qidiruv parametrlarini tekshiring"},{status:400});
    }
    const db=database();
    // A product's model is the admin's choice or derived from its name, so resolve it to product ids first.
    let modelIds:string[]|null=null;
    if (model) {
      const named=await db.query(`SELECT id,name,model FROM products WHERE store_id=$1 AND published AND ($2::text IS NULL OR category=$2)`,[storeId,category]);
      modelIds=named.rows.filter(r=>productModel(r.model,r.name)===model).map(r=>r.id);
    }
    const [page,categories]=await Promise.all([
      db.query(
        `WITH base AS (
           SELECT p.*,CASE $5::text WHEN 'new' THEN -extract(epoch FROM p.created_at) WHEN 'price_asc' THEN fp.price WHEN 'price_desc' THEN -fp.price ELSE 0 END AS sort_key
           FROM products p
           CROSS JOIN LATERAL (SELECT min(v.price_uzs) AS price FROM variants v
             WHERE v.store_id=p.store_id AND v.product_id=p.id AND v.active) fp
           WHERE p.store_id=$1 AND p.published
             AND ($2::text IS NULL OR p.category=$2)
             AND ($6::uuid[] IS NULL OR p.id=ANY($6::uuid[]))
             AND EXISTS (
               SELECT 1 FROM variants v WHERE v.store_id=p.store_id AND v.product_id=p.id AND v.active
                 AND ($3::text IS NULL OR strpos(lower(concat_ws(' ',p.name,p.category,v.color,v.storage_label)),lower($3))>0
                   OR EXISTS (SELECT 1 FROM jsonb_each_text(v.option_values) opt WHERE strpos(lower(opt.value),lower($3))>0))
             )
         ), matches AS (
           SELECT b.* FROM base b
           WHERE $4::uuid IS NULL OR (b.sort_key,b.name,b.id) > (
             SELECT CASE $5::text WHEN 'new' THEN -extract(epoch FROM c.created_at) WHEN 'price_asc' THEN fp.price WHEN 'price_desc' THEN -fp.price ELSE 0 END,c.name,c.id
             FROM products c CROSS JOIN LATERAL (SELECT min(v.price_uzs) AS price FROM variants v
               WHERE v.store_id=c.store_id AND v.product_id=c.id AND v.active) fp
             WHERE c.store_id=$1 AND c.id=$4 AND c.published)
           ORDER BY b.sort_key,b.name,b.id LIMIT 25
         ), page AS (SELECT * FROM matches ORDER BY sort_key,name,id LIMIT 24)
         SELECT p.id,p.name,p.category,p.description,p.image_url,p.option_groups,v.id AS variant_id,
           v.color,v.storage_label,v.option_values,v.image_url AS variant_image_url,v.price_uzs::text,
           v.quantity>0 AS in_stock,(SELECT count(*)>24 FROM matches) AS has_more
         FROM page p JOIN variants v ON v.product_id=p.id AND v.store_id=p.store_id AND v.active
         ORDER BY p.sort_key,p.name,p.id,v.color,v.id`,
        [storeId,category,query,after,sort,modelIds]
      ),
      db.query(`SELECT DISTINCT p.category FROM products p WHERE p.store_id=$1 AND p.published
                AND EXISTS (SELECT 1 FROM variants v WHERE v.store_id=p.store_id AND v.product_id=p.id AND v.active)
                ORDER BY p.category`,[storeId])
    ]);
    const rows=page.rows;
    const next=rows[0]?.has_more ? rows[rows.length-1].id : null;
    return NextResponse.json({next,categories:categories.rows.map(r=>r.category),items:rows.map(r=>{
      const groups=(r.option_groups as OptionGroup[]).map(g=>({...g,values:g.values.map(v=>({...v,imageUrl:v.imageUrl&&approvedImageUrl(v.imageUrl)?v.imageUrl:null}))}));
      const selection=r.option_values as OptionSelection;
      const image=variantImage(groups,selection,r.variant_image_url&&approvedImageUrl(r.variant_image_url)?r.variant_image_url:null,r.image_url&&approvedImageUrl(r.image_url)?r.image_url:null);
      const {variant_image_url:unused,has_more,...rest}=r;
      return {...rest,option_groups:groups,image_url:image};
    })},{headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:"Katalog vaqtincha mavjud emas"},{status:503});
  }
}
