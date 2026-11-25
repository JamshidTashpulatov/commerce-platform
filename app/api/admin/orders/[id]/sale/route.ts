import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../../../lib/server/db";
import {requireStoreRole} from "../../../../../../lib/server/auth";
import {isUuid,sameOrigin,smallJson,privateHeaders} from "../../../../../../lib/server/http";
export const runtime="nodejs";
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return response({error:"Ruxsat yo‘q"},403);
 const {id}=await params;const body=await smallJson(request);
 if(!isUuid(id)||!body||typeof body.revision!=="number"||!Number.isInteger(body.revision)||body.revision<0)return response({error:"Ma’lumotlarni tekshiring"},400);
 try{
  const storeId=configuredStoreId();const member=await requireStoreRole(storeId,["owner","admin","seller"]);
  if(!member)return response({error:"Ruxsat yo‘q"},403);
  const c=await database().connect();
  try{
   await c.query("BEGIN");
   const order=await c.query("SELECT revision,sale_status,request_status FROM orders WHERE store_id=$1 AND id=$2 FOR UPDATE",[storeId,id]);
   if(!order.rows.length){await c.query("ROLLBACK");return response({error:"Buyurtma topilmadi"},404);}
   const o=order.rows[0];
   if(o.sale_status!=="not_sold"||o.request_status==="cancelled"||o.revision!==body.revision){await c.query("ROLLBACK");return response({error:"Holat o‘zgargan. Buyurtmani yangilang."},409);}
   const items=await c.query("SELECT variant_id,quantity FROM order_items WHERE store_id=$1 AND order_id=$2 ORDER BY variant_id",[storeId,id]);
   if(!items.rows.length){await c.query("ROLLBACK");return response({error:"Buyurtma bo‘sh"},409);}
   for(const item of items.rows){
    const result=await c.query("UPDATE variants SET quantity=quantity-$1 WHERE store_id=$2 AND id=$3 AND active=true AND quantity >= $1 RETURNING id",[item.quantity,storeId,item.variant_id]);
    if(!result.rowCount){await c.query("ROLLBACK");return response({error:"Omborda mahsulot yetarli emas"},409);}
    await c.query("INSERT INTO stock_movements(store_id,variant_id,delta,reason,created_by) VALUES($1,$2,$3,'sale',$4)",[storeId,item.variant_id,-item.quantity,member.account_id]);
   }
   const changed=await c.query("UPDATE orders SET sale_status='sold',request_status='in_progress',revision=revision+1 WHERE store_id=$1 AND id=$2 RETURNING id,sale_status,revision",[storeId,id]);
   await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'sale_confirmed','order',$3)",[storeId,member.account_id,id]);
   await c.query("COMMIT");return response({order:changed.rows[0]});
  }catch{await c.query("ROLLBACK");return response({error:"Sotuvni saqlash imkoni bo‘lmadi"},503);}finally{c.release();}
 }catch{return response({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
