import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../../lib/server/db";
import {requireStoreRole} from "../../../../../lib/server/auth";
import {isUuid,privateHeaders} from "../../../../../lib/server/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const missing=()=>NextResponse.json({error:"Rasm topilmadi"},{status:404,headers:privateHeaders});
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{
 const {id}=await params;if(!isUuid(id))return missing();
 const store=configuredStoreId();const path="/api/catalog/media/"+id.toLowerCase();
 const admin=!!await requireStoreRole(store,["owner","admin"]);
 const r=await database().query(`SELECT m.image_bytes FROM catalog_media m WHERE m.store_id=$1 AND m.id=$2 AND ($3::boolean OR EXISTS(
 SELECT 1 FROM products p JOIN variants v ON v.store_id=p.store_id AND v.product_id=p.id AND v.active=true
 WHERE p.store_id=m.store_id AND p.published=true AND (p.image_url=$4 OR v.image_url=$4 OR EXISTS(
 SELECT 1 FROM jsonb_array_elements(p.option_groups) g CROSS JOIN LATERAL jsonb_array_elements(g->'values') val
 WHERE val->>'imageUrl'=$4
 ))
 ))`,[store,id,admin,path]);
 if(!r.rowCount)return missing();
 return new Response(new Uint8Array(r.rows[0].image_bytes),{headers:{"Content-Type":"image/webp","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'","Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({error:"Rasmni yuklab bo‘lmadi"},{status:503,headers:privateHeaders});}
}
