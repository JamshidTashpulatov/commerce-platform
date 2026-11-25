import {NextResponse} from "next/server";
import {randomUUID} from "node:crypto";
import {database,configuredStoreId} from "../../../../../../lib/server/db";
import {requireStoreRole} from "../../../../../../lib/server/auth";
import {isUuid,sameOrigin,smallJson,privateHeaders} from "../../../../../../lib/server/http";
import {customerConfig,customerSummary} from "../../../../../../lib/server/customers";
import {seal,unseal,fieldContext} from "../../../../../../lib/server/customer-crypto";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
type Context={params:Promise<{id:string}>};

/**
 * Contact details of a website purchase request, for staff who have to call the customer.
 * Owner, admin and seller only; decrypted per request, never cached, never logged.
 * An order that did not come from the website answers {checkout:null}.
 */
export async function GET(_request:Request,{params}:Context){
 const {id}=await params;if(!isUuid(id))return reply({error:"Buyurtma topilmadi"},404);
 try{
 const store=configuredStoreId();if(!await requireStoreRole(store,["owner","admin","seller"]))return reply({error:"Ruxsat yo‘q"},403);
 const c=await database().connect();
 try{
 await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 const o=await c.query(`SELECT o.customer_record_id,w.id,w.reference,w.channel,w.name_cipher,w.phone_cipher,w.phone_lookup,w.comment_cipher,w.created_at,(w.telegram_account_id IS NOT NULL) AS telegram_signed_in
  FROM orders o LEFT JOIN website_checkouts w ON w.store_id=o.store_id AND w.id=o.website_checkout_id WHERE o.store_id=$1 AND o.id=$2`,[store,id]);
 if(!o.rowCount){await c.query("ROLLBACK");return reply({error:"Buyurtma topilmadi"},404);}
 const w=o.rows[0];
 if(!w.id){await c.query("COMMIT");return reply({checkout:null});}
 const keys=customerConfig();
 const open=(cipher:string,field:string)=>unseal(keys.encryption,cipher,fieldContext(store,w.id,field));
 const siblings=await c.query(`SELECT s.id,s.request_status,s.sale_status,i.quantity,p.name,v.color,v.storage_label FROM orders s
  LEFT JOIN order_items i ON i.store_id=s.store_id AND i.order_id=s.id
  LEFT JOIN variants v ON v.store_id=i.store_id AND v.id=i.variant_id LEFT JOIN products p ON p.store_id=v.store_id AND p.id=v.product_id
  WHERE s.store_id=$1 AND s.website_checkout_id=$2 AND s.id<>$3 ORDER BY s.created_at,s.id LIMIT 20`,[store,w.id,id]);
 const match=await c.query("SELECT id,name_cipher,phone_cipher,passport_cipher IS NOT NULL AS has_passport FROM customers WHERE store_id=$1 AND phone_lookup=$2",[store,w.phone_lookup]);
 await c.query("COMMIT");
 return reply({checkout:{reference:w.reference,channel:w.channel,name:open(w.name_cipher,"name"),phone:open(w.phone_cipher,"phone"),comment:w.comment_cipher?open(w.comment_cipher,"comment"):null,created_at:w.created_at,telegram_signed_in:w.telegram_signed_in},
  siblings:siblings.rows,existing_customer:match.rows[0]?customerSummary(match.rows[0],store,keys.encryption):null,customer_linked:w.customer_record_id!==null});
 }catch{await c.query("ROLLBACK");return reply({error:"Sayt buyurtmasi ma’lumotlarini yuklab bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Mijozlar moduli sozlanmagan yoki vaqtincha ishlamayapti"},503);}
}

/**
 * One-press "create or link a customer record" from the website contact. If a customer with the
 * same phone already exists it is linked; otherwise one is created from the name and phone the
 * customer typed (no passport), then linked. Same effect as the manual find, create and attach.
 */
export async function POST(request:Request,{params}:Context){
 if(!sameOrigin(request))return reply({error:"Ruxsat yo‘q"},403);
 const {id}=await params;const b=await smallJson(request);
 if(!isUuid(id)||b?.action!=="linkCustomer")return reply({error:"Ma’lumotlarni tekshiring"},400);
 // Optional: the passport or ID number staff took over the phone. Only used when a new record is created;
 // there is no way to add one to an existing customer, and instalment schedules need it.
 const passport=typeof b.passport==="string"?b.passport.trim().toUpperCase():"";
 if(passport&&!/^[A-Z0-9]{6,20}$/.test(passport))return reply({error:"Hujjat raqamini tekshiring"},400);
 try{
 const store=configuredStoreId();const member=await requireStoreRole(store,["owner","admin","seller"]);if(!member)return reply({error:"Ruxsat yo‘q"},403);
 const keys=customerConfig();const c=await database().connect();
 try{
 await c.query("BEGIN");
 const o=await c.query(`SELECT o.customer_record_id,o.request_status,w.id,w.name_cipher,w.phone_cipher,w.phone_lookup FROM orders o
  JOIN website_checkouts w ON w.store_id=o.store_id AND w.id=o.website_checkout_id WHERE o.store_id=$1 AND o.id=$2 FOR UPDATE OF o`,[store,id]);
 if(!o.rowCount){await c.query("ROLLBACK");return reply({error:"Bu buyurtma saytdan kelmagan"},404);}
 const w=o.rows[0];
 if(w.customer_record_id||w.request_status==="cancelled"){await c.query("ROLLBACK");return reply({error:"Buyurtma mavjud emas yoki mijoz allaqachon biriktirilgan"},409);}
 const name=unseal(keys.encryption,w.name_cipher,fieldContext(store,w.id,"name"));
 const phone=unseal(keys.encryption,w.phone_cipher,fieldContext(store,w.id,"phone"));
 const customerId=randomUUID();
 const made=await c.query("INSERT INTO customers(id,store_id,name_cipher,phone_cipher,phone_lookup,passport_cipher,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(store_id,phone_lookup) DO NOTHING RETURNING id",
  [customerId,store,seal(keys.encryption,name,fieldContext(store,customerId,"name")),seal(keys.encryption,phone,fieldContext(store,customerId,"phone")),w.phone_lookup,passport?seal(keys.encryption,passport,fieldContext(store,customerId,"passport")):null,member.account_id]);
 if(made.rowCount)await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'customer_created','customer',$3)",[store,member.account_id,customerId]);
 const customer=await c.query("SELECT id,name_cipher,phone_cipher,passport_cipher IS NOT NULL AS has_passport FROM customers WHERE store_id=$1 AND phone_lookup=$2",[store,w.phone_lookup]);
 if(!customer.rowCount){await c.query("ROLLBACK");return reply({error:"Mijozni biriktirib bo‘lmadi"},503);}
 const linked=await c.query("UPDATE orders SET customer_record_id=$1,revision=revision+1 WHERE store_id=$2 AND id=$3 AND customer_record_id IS NULL AND request_status<>'cancelled' RETURNING id",[customer.rows[0].id,store,id]);
 if(!linked.rowCount){await c.query("ROLLBACK");return reply({error:"Buyurtma mavjud emas yoki mijoz allaqachon biriktirilgan"},409);}
 await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'customer_linked','order',$3)",[store,member.account_id,id]);
 await c.query("COMMIT");
 return reply({customer:customerSummary(customer.rows[0],store,keys.encryption),created:!!made.rowCount},made.rowCount?201:200);
 }catch{await c.query("ROLLBACK");return reply({error:"Mijozni biriktirib bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Mijozlar moduli sozlanmagan yoki vaqtincha ishlamayapti"},503);}
}
