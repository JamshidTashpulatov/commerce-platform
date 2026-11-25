import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../lib/server/db";
import {requireStoreRole} from "../../../../lib/server/auth";
import {isUuid,sameOrigin,smallJson,privateHeaders} from "../../../../lib/server/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
export async function GET(){
 try{
  const storeId=configuredStoreId();
  if(!await requireStoreRole(storeId,["owner","admin","seller"]))return response({error:"Ruxsat yo‘q"},403);
  const {rows}=await database().query("SELECT o.id,o.source,o.request_status,o.sale_status,o.fulfillment_status,o.revision,o.currency,o.created_at,COALESCE(SUM(i.unit_price_uzs::numeric*i.quantity),0)::text AS total_uzs FROM orders o LEFT JOIN order_items i ON i.store_id=o.store_id AND i.order_id=o.id WHERE o.store_id=$1 GROUP BY o.id ORDER BY o.created_at DESC LIMIT 100",[storeId]);
  return response({items:rows});
 }catch{return response({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return response({error:"Ruxsat yo‘q"},403);
 const body=await smallJson(request);
 if(!body||!isUuid(body.variantId)||!isUuid(body.requestKey)||typeof body.quantity!=="number"||!Number.isSafeInteger(body.quantity)||body.quantity<1||body.quantity>100)return response({error:"Ma’lumotlarni tekshiring"},400);
 try{
  const storeId=configuredStoreId();const member=await requireStoreRole(storeId,["owner","admin","seller"]);
  if(!member)return response({error:"Ruxsat yo‘q"},403);
  const c=await database().connect();
  try{
   await c.query("BEGIN");
   const duplicate=await c.query("SELECT id,created_by FROM orders WHERE store_id=$1 AND request_key=$2",[storeId,body.requestKey]);
   if(duplicate.rows.length){await c.query("ROLLBACK");return duplicate.rows[0].created_by===member.account_id?response({id:duplicate.rows[0].id,repeated:true}):response({error:"So‘rov kaliti band"},409);}
   const variant=await c.query("SELECT id,quantity,price_uzs FROM variants WHERE store_id=$1 AND id=$2 AND active=true FOR UPDATE",[storeId,body.variantId]);
   if(!variant.rows.length||variant.rows[0].quantity<body.quantity){await c.query("ROLLBACK");return response({error:"Mahsulot yetarli emas"},409);}
   const result=await c.query("INSERT INTO orders(store_id,source,created_by,request_key) VALUES($1,'staff',$2,$3) ON CONFLICT(store_id,request_key) DO NOTHING RETURNING id",[storeId,member.account_id,body.requestKey]);
   if(!result.rows.length){await c.query("ROLLBACK");return response({error:"So‘rov takrorlandi. Buyurtmalarni yangilang."},409);}
   const id=result.rows[0].id;
   await c.query("INSERT INTO order_items(store_id,order_id,variant_id,quantity,unit_price_uzs) VALUES($1,$2,$3,$4,$5)",[storeId,id,body.variantId,body.quantity,variant.rows[0].price_uzs]);
   await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'request_created','order',$3)",[storeId,member.account_id,id]);
   await c.query("COMMIT");return response({id},201);
  }catch{await c.query("ROLLBACK");return response({error:"Saqlash imkoni bo‘lmadi"},503);}finally{c.release();}
 }catch{return response({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
