import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../lib/server/db";
import {requireStoreRole} from "../../../../lib/server/auth";
import {isUuid,sameOrigin,smallJson,privateHeaders} from "../../../../lib/server/http";
import {validDate} from "../../../../lib/installment-schedule";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
const amount=(v:unknown):v is string=>typeof v==="string"&&/^[1-9][0-9]{0,11}$/.test(v);
export async function GET(){
 try{
 const store=configuredStoreId();if(!await requireStoreRole(store,["owner","admin"]))return reply({error:"Ruxsat yo‘q"},403);
 const c=await database().connect();
 try{
 await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 const suppliers=await c.query("SELECT s.id,s.display_name,COALESCE(SUM(i.amount_uzs),0)::text AS total_uzs,COALESCE(SUM(i.paid_uzs),0)::text AS paid_uzs,COALESCE(SUM(i.outstanding_uzs),0)::text AS outstanding_uzs FROM suppliers s LEFT JOIN supplier_invoice_balances i ON i.store_id=s.store_id AND i.supplier_id=s.id WHERE s.store_id=$1 GROUP BY s.id ORDER BY s.display_name,s.id LIMIT 201",[store]);
 const invoices=await c.query("SELECT i.id,i.supplier_id,s.display_name,i.reference,i.amount_uzs::text,i.paid_uzs::text,i.outstanding_uzs::text,i.due_date::text,i.created_at,CASE WHEN i.outstanding_uzs=0 THEN 'paid' WHEN i.due_date < (now() AT TIME ZONE 'Asia/Tashkent')::date THEN 'overdue' ELSE 'open' END AS status FROM supplier_invoice_balances i JOIN suppliers s ON s.store_id=i.store_id AND s.id=i.supplier_id WHERE i.store_id=$1 ORDER BY i.created_at DESC,i.id LIMIT 201",[store]);
 const payments=await c.query("SELECT p.id,p.invoice_id,p.amount_uzs::text,COALESCE(p.paid_on,(p.paid_at AT TIME ZONE 'Asia/Tashkent')::date)::text AS paid_on,p.method,(v.payment_id IS NOT NULL) AS reversed FROM supplier_payments p LEFT JOIN supplier_payment_reversals v ON v.store_id=p.store_id AND v.payment_id=p.id WHERE p.store_id=$1 ORDER BY p.paid_at DESC,p.id LIMIT 201",[store]);
 await c.query("COMMIT");
 return reply({suppliers:suppliers.rows.slice(0,200),invoices:invoices.rows.slice(0,200),payments:payments.rows.slice(0,200),truncated:[suppliers,invoices,payments].some(r=>r.rows.length>200),enabled:process.env.SUPPLIER_POSTING_ENABLED==="true"});
 }catch{await c.query("ROLLBACK");return reply({error:"Hisobot yuklanmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Ruxsat yo‘q"},403);
 const b=await smallJson(request);if(!b)return reply({error:"Ma’lumotlarni tekshiring"},400);
 const action=b.action;
 if(action==="supplier"){
 if(typeof b.name!=="string"||b.name.trim().length<2||b.name.trim().length>120||!isUuid(b.key))return reply({error:"Nom va so‘rov kalitini tekshiring"},400);
 }else if(action==="invoice"){
 if(!isUuid(b.supplierId)||!isUuid(b.key)||!amount(b.amount)||(b.dueDate!==null&&!validDate(b.dueDate))||typeof b.reference!=="string"||b.reference.length>120)return reply({error:"Xarid ma’lumotlarini tekshiring"},400);
 }else if(action==="payment"){
 if(!isUuid(b.invoiceId)||!isUuid(b.key)||!amount(b.amount)||!validDate(b.date)||!["cash","transfer","other"].includes(String(b.method)))return reply({error:"To‘lov ma’lumotlarini tekshiring"},400);
 }else if(action==="reverse"){
 if(!isUuid(b.paymentId)||typeof b.reason!=="string"||b.reason.trim().length<3||b.reason.trim().length>240)return reply({error:"Tuzatish sababini kiriting"},400);
 }else return reply({error:"Noma’lum amal"},400);
 try{
 const store=configuredStoreId();const actor=await requireStoreRole(store,["owner","admin"]);if(!actor)return reply({error:"Ruxsat yo‘q"},403);
 if(process.env.SUPPLIER_POSTING_ENABLED!=="true")return reply({error:"Modul hali yoqilmagan"},503);
 const c=await database().connect();
 try{
 await c.query("BEGIN");
 const fail=async(error:string,status=409)=>{await c.query("ROLLBACK");return reply({error},status);};
 const repeat=async(id:string)=>{await c.query("ROLLBACK");return reply({id,repeated:true});};
 let id:string;
 if(action==="supplier"){
 const name=String(b.name).trim();
 const r=await c.query("INSERT INTO suppliers(store_id,display_name,request_key) VALUES($1,$2,$3) ON CONFLICT(store_id,request_key) DO NOTHING RETURNING id",[store,name,b.key]);
 if(!r.rowCount){const d=await c.query("SELECT id,display_name FROM suppliers WHERE store_id=$1 AND request_key=$2",[store,b.key]);return d.rows[0]?.display_name===name?await repeat(d.rows[0].id):await fail("So‘rov kaliti band");}id=r.rows[0].id;
 }else if(action==="invoice"){
 const supplier=await c.query("SELECT id FROM suppliers WHERE store_id=$1 AND id=$2",[store,b.supplierId]);if(!supplier.rowCount)return await fail("Yetkazib beruvchi topilmadi",404);
 const reference=String(b.reference).trim();
 const r=await c.query("INSERT INTO supplier_invoices(store_id,supplier_id,amount_uzs,due_date,reference,request_key) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(store_id,request_key) DO NOTHING RETURNING id",[store,b.supplierId,b.amount,b.dueDate,reference,b.key]);
 if(!r.rowCount){const d=await c.query("SELECT id,supplier_id,amount_uzs::text,due_date::text,reference FROM supplier_invoices WHERE store_id=$1 AND request_key=$2",[store,b.key]);const p=d.rows[0];return p&&p.supplier_id===String(b.supplierId).toLowerCase()&&p.amount_uzs===b.amount&&p.due_date===b.dueDate&&p.reference===reference?await repeat(p.id):await fail("So‘rov kaliti band");}id=r.rows[0].id;
 }else if(action==="payment"){
 const lock=await c.query("SELECT id FROM supplier_invoices WHERE store_id=$1 AND id=$2 FOR UPDATE",[store,b.invoiceId]);if(!lock.rowCount)return await fail("Xarid topilmadi",404);
 const d=await c.query("SELECT id,invoice_id,amount_uzs::text,paid_on::text,method FROM supplier_payments WHERE store_id=$1 AND idempotency_key=$2",[store,b.key]);
 if(d.rowCount){const p=d.rows[0];return p.invoice_id===String(b.invoiceId).toLowerCase()&&p.amount_uzs===b.amount&&p.paid_on===b.date&&p.method===b.method?await repeat(p.id):await fail("So‘rov kaliti band");}
 const date=await c.query("SELECT $1::date <= (now() AT TIME ZONE 'Asia/Tashkent')::date AS valid",[b.date]);if(!date.rows[0].valid)return await fail("Kelajak sanasidagi to‘lovni qayd etib bo‘lmaydi",400);
 const balance=await c.query("SELECT outstanding_uzs FROM supplier_invoice_balances WHERE store_id=$1 AND id=$2",[store,b.invoiceId]);if(BigInt(String(b.amount))>BigInt(balance.rows[0].outstanding_uzs))return await fail("To‘lov qarz qoldig‘idan oshmoqda");
 const r=await c.query("INSERT INTO supplier_payments(store_id,invoice_id,amount_uzs,idempotency_key,method,paid_on,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(store_id,idempotency_key) DO NOTHING RETURNING id",[store,b.invoiceId,b.amount,b.key,b.method,b.date,actor.account_id]);if(!r.rowCount)return await fail("So‘rov kaliti band");id=r.rows[0].id;
 }else{
 const lock=await c.query("SELECT i.id FROM supplier_payments p JOIN supplier_invoices i ON i.store_id=p.store_id AND i.id=p.invoice_id WHERE p.store_id=$1 AND p.id=$2 FOR UPDATE OF i",[store,b.paymentId]);if(!lock.rowCount)return await fail("To‘lov topilmadi",404);
 const r=await c.query("INSERT INTO supplier_payment_reversals(store_id,payment_id,reversed_by,reason) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING payment_id",[store,b.paymentId,actor.account_id,String(b.reason).trim()]);if(!r.rowCount)return await fail("To‘lov avval bekor qilingan");id=r.rows[0].payment_id;
 }
 await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,$3,'supplier_record',$4)",[store,actor.account_id,"supplier_"+action,id]);
 await c.query("COMMIT");return reply({id},201);
 }catch{await c.query("ROLLBACK");return reply({error:"Qaydni saqlab bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
