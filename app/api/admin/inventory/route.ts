import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../lib/server/db";
import {requireStoreRole} from "../../../../lib/server/auth";
import {isUuid,sameOrigin,smallJson,privateHeaders} from "../../../../lib/server/http";
import {validDate} from "../../../../lib/installment-schedule";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
export async function GET(){
 try{
 const store=configuredStoreId();if(!await requireStoreRole(store,["owner","admin"]))return reply({error:"Ruxsat yo‘q"},403);
 const c=await database().connect();
 try{
 await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 const variants=await c.query("SELECT v.id,p.name,v.sku,v.color,v.storage_label,v.quantity,v.active FROM variants v JOIN products p ON p.store_id=v.store_id AND p.id=v.product_id WHERE v.store_id=$1 ORDER BY p.name,v.sku LIMIT 501",[store]);
 const invoices=await c.query(`SELECT i.id,s.display_name,i.reference,i.amount_uzs::text,
 COALESCE(r.received,0)::text AS received_uzs,(i.amount_uzs-COALESCE(r.received,0))::text AS unreceived_uzs
 FROM supplier_invoices i JOIN suppliers s ON s.store_id=i.store_id AND s.id=i.supplier_id
 LEFT JOIN LATERAL (SELECT SUM(quantity::numeric*unit_cost_uzs) AS received FROM purchase_stock_receipts WHERE store_id=i.store_id AND invoice_id=i.id) r ON true
 WHERE i.store_id=$1 ORDER BY i.created_at DESC,i.id LIMIT 201`,[store]);
 const receipts=await c.query(`SELECT r.id,r.invoice_id,r.variant_id,r.quantity,r.unit_cost_uzs::text,(r.quantity::numeric*r.unit_cost_uzs)::text AS total_uzs,r.received_on::text,p.name,v.sku,s.display_name
 FROM purchase_stock_receipts r JOIN variants v ON v.store_id=r.store_id AND v.id=r.variant_id JOIN products p ON p.store_id=v.store_id AND p.id=v.product_id
 JOIN supplier_invoices i ON i.store_id=r.store_id AND i.id=r.invoice_id JOIN suppliers s ON s.store_id=i.store_id AND s.id=i.supplier_id
 WHERE r.store_id=$1 ORDER BY r.created_at DESC,r.id LIMIT 201`,[store]);
 await c.query("COMMIT");return reply({variants:variants.rows.slice(0,500),invoices:invoices.rows.slice(0,200),receipts:receipts.rows.slice(0,200),truncated:variants.rows.length>500||invoices.rows.length>200||receipts.rows.length>200,enabled:process.env.STOCK_RECEIPTS_ENABLED==="true"});
 }catch{await c.query("ROLLBACK");return reply({error:"Omborni yuklab bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Ruxsat yo‘q"},403);
 const b=await smallJson(request);
 if(!b||!isUuid(b.invoiceId)||!isUuid(b.variantId)||!isUuid(b.key)||typeof b.quantity!=="number"||!Number.isSafeInteger(b.quantity)||b.quantity<1||b.quantity>10000||typeof b.unitCost!=="string"||!/^[1-9][0-9]{0,11}$/.test(b.unitCost)||!validDate(b.date))return reply({error:"Kirim ma’lumotlarini tekshiring"},400);
 try{
 const store=configuredStoreId();const actor=await requireStoreRole(store,["owner","admin"]);if(!actor)return reply({error:"Ruxsat yo‘q"},403);
 if(process.env.STOCK_RECEIPTS_ENABLED!=="true")return reply({error:"Ombor kirimi hali yoqilmagan"},503);
 const c=await database().connect();
 try{
 await c.query("BEGIN");
 const fail=async(error:string,status=409)=>{await c.query("ROLLBACK");return reply({error},status);};
 const invoice=await c.query("SELECT amount_uzs FROM supplier_invoices WHERE store_id=$1 AND id=$2 FOR UPDATE",[store,b.invoiceId]);
 if(!invoice.rowCount)return await fail("Xarid topilmadi",404);
 const d=await c.query("SELECT id,invoice_id,variant_id,quantity,unit_cost_uzs::text,received_on::text FROM purchase_stock_receipts WHERE store_id=$1 AND request_key=$2",[store,b.key]);
 if(d.rowCount){const r=d.rows[0];const same=r.invoice_id===String(b.invoiceId).toLowerCase()&&r.variant_id===String(b.variantId).toLowerCase()&&r.quantity===b.quantity&&r.unit_cost_uzs===b.unitCost&&r.received_on===b.date;await c.query("ROLLBACK");return same?reply({id:r.id,repeated:true}):reply({error:"So‘rov kaliti band"},409);}
 const date=await c.query("SELECT $1::date <= (now() AT TIME ZONE 'Asia/Tashkent')::date AS valid",[b.date]);if(!date.rows[0].valid)return await fail("Kelajakdagi kirimni qayd etib bo‘lmaydi",400);
 const total=BigInt(b.quantity)*BigInt(b.unitCost);
 const used=await c.query("SELECT COALESCE(SUM(quantity::numeric*unit_cost_uzs),0)::text AS amount FROM purchase_stock_receipts WHERE store_id=$1 AND invoice_id=$2",[store,b.invoiceId]);
 if(BigInt(used.rows[0].amount)+total>BigInt(invoice.rows[0].amount_uzs))return await fail("Kirim qiymati xaridning qolgan summasidan oshmoqda");
 const stock=await c.query("UPDATE variants SET quantity=quantity+$3 WHERE store_id=$1 AND id=$2 AND active=true AND quantity<=2147483647-$3 RETURNING id",[store,b.variantId,b.quantity]);
 if(!stock.rowCount)return await fail("Faol mahsulot varianti topilmadi yoki qoldiq chegaradan oshdi");
 const movement=await c.query("INSERT INTO stock_movements(store_id,variant_id,delta,reason,created_by) VALUES($1,$2,$3,'receipt',$4) RETURNING id",[store,b.variantId,b.quantity,actor.account_id]);
 const r=await c.query("INSERT INTO purchase_stock_receipts(store_id,invoice_id,variant_id,quantity,unit_cost_uzs,received_on,request_key,recorded_by,stock_movement_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(store_id,request_key) DO NOTHING RETURNING id",[store,b.invoiceId,b.variantId,b.quantity,b.unitCost,b.date,b.key,actor.account_id,movement.rows[0].id]);
 if(!r.rowCount)return await fail("So‘rov kaliti band");
 const id=r.rows[0].id;
 await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'purchase_stock_received','stock_receipt',$3)",[store,actor.account_id,id]);
 await c.query("COMMIT");return reply({id},201);
 }catch{await c.query("ROLLBACK");return reply({error:"Kirimni saqlab bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
