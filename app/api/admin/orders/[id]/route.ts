import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../../lib/server/db";
import {requireStoreRole} from "../../../../../lib/server/auth";
import {isUuid,sameOrigin,smallJson,privateHeaders} from "../../../../../lib/server/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,{params}:Context){
 try{
  const {id}=await params;if(!isUuid(id))return response({error:"Buyurtma topilmadi"},404);
  const storeId=configuredStoreId();
  if(!await requireStoreRole(storeId,["owner","admin","seller"]))return response({error:"Ruxsat yo‘q"},403);
  const {rows}=await database().query("SELECT id,source,request_status,sale_status,fulfillment_status,revision,created_at FROM orders WHERE store_id=$1 AND id=$2",[storeId,id]);
  if(!rows.length)return response({error:"Buyurtma topilmadi"},404);
  const items=await database().query("SELECT i.variant_id,p.name,v.color,v.storage_label,i.quantity,i.unit_price_uzs::text FROM order_items i JOIN variants v ON v.store_id=i.store_id AND v.id=i.variant_id JOIN products p ON p.store_id=v.store_id AND p.id=v.product_id WHERE i.store_id=$1 AND i.order_id=$2",[storeId,id]);
  return response({order:rows[0],items:items.rows});
 }catch{return response({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
export async function PATCH(request:Request,{params}:Context){
 if(!sameOrigin(request))return response({error:"Ruxsat yo‘q"},403);
 const {id}=await params;const body=await smallJson(request);
 if(!isUuid(id)||!body||typeof body.revision!=="number"||!Number.isInteger(body.revision)||body.revision<0||!["new","in_progress","cancelled"].includes(String(body.status)))return response({error:"Ma’lumotlarni tekshiring"},400);
 try{
  const storeId=configuredStoreId();const member=await requireStoreRole(storeId,["owner","admin","seller"]);
  if(!member)return response({error:"Ruxsat yo‘q"},403);
  const c=await database().connect();
  try{
   await c.query("BEGIN");
   const {rows}=await c.query("UPDATE orders SET request_status=$1,revision=revision+1 WHERE store_id=$2 AND id=$3 AND revision=$4 AND sale_status='not_sold' AND fulfillment_status='not_delivered' RETURNING id,request_status,revision",[body.status,storeId,id,body.revision]);
   if(!rows.length){await c.query("ROLLBACK");return response({error:"Buyurtma o‘zgargan yoki mavjud emas. Yangilang."},409);}
   await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,$3,'order',$4)",[storeId,member.account_id,"request_status:"+body.status,id]);
   await c.query("COMMIT");return response({order:rows[0]});
  }catch{await c.query("ROLLBACK");return response({error:"Saqlash imkoni bo‘lmadi"},503);}finally{c.release();}
 }catch{return response({error:"Xizmat vaqtincha ishlamayapti"},503);}
}

export async function PUT(request:Request,{params}:Context){
 if(!sameOrigin(request))return response({error:"Ruxsat yo‘q"},403);
 const {id}=await params;const body=await smallJson(request);
 if(!isUuid(id)||!body||typeof body.revision!=="number"||!Number.isInteger(body.revision)||body.revision<0||!["not_delivered","in_transit","delivered"].includes(String(body.fulfillment)))return response({error:"Ma’lumotlarni tekshiring"},400);
 try{
  const storeId=configuredStoreId();const member=await requireStoreRole(storeId,["owner","admin","seller"]);
  if(!member)return response({error:"Ruxsat yo‘q"},403);
  const c=await database().connect();
  try{
   await c.query("BEGIN");
   const {rows}=await c.query("UPDATE orders SET fulfillment_status=$1,revision=revision+1 WHERE store_id=$2 AND id=$3 AND revision=$4 AND sale_status='sold' AND fulfillment_status<>'delivered' RETURNING id,fulfillment_status,revision",[body.fulfillment,storeId,id,body.revision]);
   if(!rows.length){await c.query("ROLLBACK");return response({error:"Holat o‘zgargan yoki sotuv tasdiqlanmagan"},409);}
   await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,$3,'order',$4)",[storeId,member.account_id,"fulfillment:"+body.fulfillment,id]);
   await c.query("COMMIT");return response({order:rows[0]});
  }catch{await c.query("ROLLBACK");return response({error:"Saqlash imkoni bo‘lmadi"},503);}finally{c.release();}
 }catch{return response({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
