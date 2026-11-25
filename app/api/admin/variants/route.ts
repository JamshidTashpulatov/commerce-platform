import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../lib/server/db";
import {requireStoreRole} from "../../../../lib/server/auth";
import {privateHeaders} from "../../../../lib/server/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
 try{
 const storeId=configuredStoreId();
 if(!await requireStoreRole(storeId,["owner","admin","seller"]))return NextResponse.json({error:"Ruxsat yo‘q"},{status:403,headers:privateHeaders});
 const {rows}=await database().query("SELECT v.id,p.name,v.color,v.storage_label,v.quantity,v.price_uzs::text FROM variants v JOIN products p ON p.store_id=v.store_id AND p.id=v.product_id WHERE v.store_id=$1 AND v.active=true ORDER BY p.name,v.color,v.storage_label LIMIT 500",[storeId]);
 return NextResponse.json({items:rows},{headers:privateHeaders});
 }catch{return NextResponse.json({error:"Mahsulotlarni yuklab bo‘lmadi"},{status:503,headers:privateHeaders});}
}
