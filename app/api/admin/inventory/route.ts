import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../lib/server/db";
import {requireStoreRole} from "../../../../lib/server/auth";
import {isUuid,sameOrigin,smallJson,privateHeaders} from "../../../../lib/server/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
const MAX_QUANTITY=100000;
// Stock on hand and the adjustments made to it. Owner and administrator only.
export async function GET(){
 try{
 const store=configuredStoreId();if(!await requireStoreRole(store,["owner","admin"]))return reply({error:"Ruxsat yo‘q"},403);
 const c=await database().connect();
 try{
 await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 const variants=await c.query("SELECT v.id,p.name,v.sku,v.color,v.storage_label,v.quantity,v.active FROM variants v JOIN products p ON p.store_id=v.store_id AND p.id=v.product_id WHERE v.store_id=$1 ORDER BY p.name,v.sku LIMIT 501",[store]);
 const adjustments=await c.query(`SELECT a.id,a.variant_id,p.name,v.sku,v.color,v.storage_label,a.quantity_before,a.quantity_after,a.note,a.created_at
  FROM stock_adjustments a JOIN variants v ON v.store_id=a.store_id AND v.id=a.variant_id JOIN products p ON p.store_id=v.store_id AND p.id=v.product_id
  WHERE a.store_id=$1 ORDER BY a.created_at DESC,a.id LIMIT 101`,[store]);
 await c.query("COMMIT");return reply({variants:variants.rows.slice(0,500),adjustments:adjustments.rows.slice(0,100),truncated:variants.rows.length>500});
 }catch{await c.query("ROLLBACK");return reply({error:"Omborni yuklab bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
// Set a variant's quantity. `expected` is the quantity the administrator saw, so two people
// correcting the same product, or a sale in between, cannot silently overwrite each other.
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Ruxsat yo‘q"},403);
 const b=await smallJson(request);
 const whole=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0&&v<=MAX_QUANTITY;
 if(!b||!isUuid(b.variantId)||!isUuid(b.key)||!whole(b.quantity)||!whole(b.expected)||typeof b.note!=="string"||b.note.trim().length<3||b.note.length>240)return reply({error:"Miqdor va sababni tekshiring"},400);
 if(b.quantity===b.expected)return reply({error:"Yangi miqdor hozirgisidan farq qilishi kerak"},400);
 try{
 const store=configuredStoreId();const actor=await requireStoreRole(store,["owner","admin"]);if(!actor)return reply({error:"Ruxsat yo‘q"},403);
 const c=await database().connect();
 try{
 await c.query("BEGIN");
 const fail=async(error:string,status=409)=>{await c.query("ROLLBACK");return reply({error},status);};
 const variant=await c.query("SELECT quantity FROM variants WHERE store_id=$1 AND id=$2 FOR UPDATE",[store,b.variantId]);
 if(!variant.rowCount)return await fail("Mahsulot varianti topilmadi",404);
 const d=await c.query("SELECT id,variant_id,quantity_before,quantity_after,note FROM stock_adjustments WHERE store_id=$1 AND request_key=$2",[store,b.key]);
 if(d.rowCount){const r=d.rows[0];const same=r.variant_id===String(b.variantId).toLowerCase()&&r.quantity_before===b.expected&&r.quantity_after===b.quantity&&r.note===b.note.trim();await c.query("ROLLBACK");return same?reply({id:r.id,repeated:true}):reply({error:"So‘rov kaliti band"},409);}
 if(variant.rows[0].quantity!==b.expected)return await fail(`Qoldiq o‘zgargan: hozir ${variant.rows[0].quantity} dona. Sahifani yangilab, qayta kiriting.`);
 await c.query("UPDATE variants SET quantity=$3 WHERE store_id=$1 AND id=$2",[store,b.variantId,b.quantity]);
 const movement=await c.query("INSERT INTO stock_movements(store_id,variant_id,delta,reason,created_by) VALUES($1,$2,$3,'adjustment',$4) RETURNING id",[store,b.variantId,b.quantity-b.expected,actor.account_id]);
 const r=await c.query("INSERT INTO stock_adjustments(store_id,variant_id,quantity_before,quantity_after,note,request_key,recorded_by,stock_movement_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",[store,b.variantId,b.expected,b.quantity,b.note.trim(),b.key,actor.account_id,movement.rows[0].id]);
 await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'stock_adjusted','stock_adjustment',$3)",[store,actor.account_id,r.rows[0].id]);
 await c.query("COMMIT");return reply({id:r.rows[0].id},201);
 }catch{await c.query("ROLLBACK");return reply({error:"Qoldiqni saqlab bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
