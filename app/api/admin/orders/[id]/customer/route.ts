import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../../../lib/server/db";
import {requireStoreRole} from "../../../../../../lib/server/auth";
import {isUuid,sameOrigin,smallJson,privateHeaders} from "../../../../../../lib/server/http";
import {customerConfig,customerSummary} from "../../../../../../lib/server/customers";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,{params}:Context){
 try{
 const {id}=await params;if(!isUuid(id))return reply({error:"Buyurtma topilmadi"},404);
 const store=configuredStoreId();if(!await requireStoreRole(store,["owner","admin","seller"]))return reply({error:"Ruxsat yo‘q"},403);
 const keys=customerConfig();
 const {rows}=await database().query("SELECT o.id AS order_id,c.id,c.name_cipher,c.phone_cipher,c.passport_cipher IS NOT NULL AS has_passport FROM orders o LEFT JOIN customers c ON c.store_id=o.store_id AND c.id=o.customer_record_id WHERE o.store_id=$1 AND o.id=$2",[store,id]);
 if(!rows.length)return reply({error:"Buyurtma topilmadi"},404);
 return reply({customer:rows[0].id?customerSummary(rows[0],store,keys.encryption):null});
 }catch{return reply({error:"Mijozlar moduli sozlanmagan yoki vaqtincha ishlamayapti"},503);}
}
export async function PUT(request:Request,{params}:Context){
 if(!sameOrigin(request))return reply({error:"Ruxsat yo‘q"},403);
 const {id}=await params;const b=await smallJson(request);if(!isUuid(id)||!isUuid(b?.customerId))return reply({error:"Mijozni tanlang"},400);
 try{
 const store=configuredStoreId();const member=await requireStoreRole(store,["owner","admin","seller"]);if(!member)return reply({error:"Ruxsat yo‘q"},403);
 customerConfig();const c=await database().connect();
 try{
 await c.query("BEGIN");
 const customer=await c.query("SELECT id FROM customers WHERE store_id=$1 AND id=$2",[store,b.customerId]);if(!customer.rowCount){await c.query("ROLLBACK");return reply({error:"Mijoz topilmadi"},404);}
 const result=await c.query("UPDATE orders SET customer_record_id=$1,revision=revision+1 WHERE store_id=$2 AND id=$3 AND customer_record_id IS NULL AND request_status<>'cancelled' RETURNING id",[b.customerId,store,id]);
 if(!result.rowCount){await c.query("ROLLBACK");return reply({error:"Buyurtma mavjud emas yoki mijoz allaqachon biriktirilgan"},409);}
 await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'customer_linked','order',$3)",[store,member.account_id,id]);
 await c.query("COMMIT");return reply({ok:true});
 }catch{await c.query("ROLLBACK");return reply({error:"Mijozni biriktirib bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Mijozlar moduli sozlanmagan yoki vaqtincha ishlamayapti"},503);}
}
