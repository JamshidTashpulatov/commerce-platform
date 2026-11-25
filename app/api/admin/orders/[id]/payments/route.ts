import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../../../lib/server/db";
import {requireStoreRole} from "../../../../../../lib/server/auth";
import {isUuid,sameOrigin,smallJson,privateHeaders} from "../../../../../../lib/server/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
type Ctx={params:Promise<{id:string}>};
const amount=(v:unknown):v is string=>typeof v==="string"&&/^(0|[1-9][0-9]{0,11})$/.test(v);
const validDate=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export async function GET(_request:Request,{params}:Ctx){
 try{
 const {id}=await params;if(!isUuid(id))return reply({error:"Buyurtma topilmadi"},404);
 const store=configuredStoreId();if(!await requireStoreRole(store,["owner","admin","seller"]))return reply({error:"Ruxsat yo‘q"},403);
 const c=await database().connect();
 try{
 await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 const o=await c.query("SELECT id FROM orders WHERE store_id=$1 AND id=$2",[store,id]);
 if(!o.rowCount){await c.query("ROLLBACK");return reply({error:"Buyurtma topilmadi"},404);}
 const t=await c.query("SELECT agreed_total_uzs::text,payment_type,initial_due_uzs::text FROM order_payment_terms WHERE store_id=$1 AND order_id=$2",[store,id]);
 const r=await c.query("SELECT r.id,r.amount_uzs::text,r.kind,r.method,r.received_on::text,r.created_at,r.recorded_by,(v.receipt_id IS NOT NULL) AS reversed FROM order_manual_receipts r LEFT JOIN order_receipt_reversals v ON v.store_id=r.store_id AND v.receipt_id=r.id WHERE r.store_id=$1 AND r.order_id=$2 ORDER BY r.created_at DESC",[store,id]);
 await c.query("COMMIT");
 const received=r.rows.reduce((sum,row)=>sum+(row.reversed?BigInt(0):BigInt(row.amount_uzs)),BigInt(0));
 return reply({terms:t.rows[0]??null,receipts:r.rows,received_uzs:received.toString(),remaining_uzs:t.rows[0]?(BigInt(t.rows[0].agreed_total_uzs)-received).toString():null});
 }catch{await c.query("ROLLBACK");return reply({error:"To‘lovlarni yuklab bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
export async function POST(request:Request,{params}:Ctx){
 if(!sameOrigin(request))return reply({error:"Ruxsat yo‘q"},403);
 const {id}=await params;const b=await smallJson(request);
 if(!isUuid(id)||!b)return reply({error:"Ma’lumotlarni tekshiring"},400);
 const action=b.action;
 if(action==="terms"){
  if(!amount(b.total)||BigInt(b.total)<=BigInt(0)||!amount(b.initial)||BigInt(b.initial)>BigInt(b.total)||!["cash","installment"].includes(String(b.type))||(b.type==="cash"?b.initial!=="0":BigInt(b.initial)<=BigInt(0)))return reply({error:"Kelishilgan summalarni tekshiring"},400);
 }else if(action==="receipt"){
  if(!amount(b.amount)||BigInt(b.amount)<=BigInt(0)||!isUuid(b.key)||!validDate(b.date)||!["cash","transfer","other"].includes(String(b.method)))return reply({error:"To‘lov ma’lumotlarini tekshiring"},400);
 }else if(action==="reverse"){
  if(!isUuid(b.receiptId)||typeof b.reason!=="string"||b.reason.trim().length<3||b.reason.length>240)return reply({error:"Bekor qilish sababini kiriting"},400);
 }else return reply({error:"Noma’lum amal"},400);
 try{
 const store=configuredStoreId();const member=await requireStoreRole(store,action==="reverse"?["owner","admin"]:["owner","admin","seller"]);
 if(!member)return reply({error:"Ruxsat yo‘q"},403);
 const c=await database().connect();
 try{
 await c.query("BEGIN");
 const fail=async(error:string,status=409)=>{await c.query("ROLLBACK");return reply({error},status);};
 const order=await c.query("SELECT request_status,sale_status FROM orders WHERE store_id=$1 AND id=$2 FOR UPDATE",[store,id]);
 if(!order.rowCount)return await fail("Buyurtma topilmadi",404);
 if(order.rows[0].request_status==="cancelled")return await fail("Buyurtma bekor qilingan");
 const terms=await c.query("SELECT agreed_total_uzs,payment_type,initial_due_uzs FROM order_payment_terms WHERE store_id=$1 AND order_id=$2",[store,id]);
 const t=terms.rows[0];let event:string;
 const activeContract=await c.query("SELECT 1 FROM installment_contracts WHERE store_id=$1 AND order_id=$2 AND status IN ('active','settled')",[store,id]);
 if(activeContract.rowCount)return await fail("Faol nasiya shartnomasi mavjud. Ushbu to‘lovlar alohida boshqariladi.");
 if(action==="terms"){
  const existing=await c.query("SELECT 1 FROM order_manual_receipts WHERE store_id=$1 AND order_id=$2 LIMIT 1",[store,id]);
  if(existing.rowCount)return await fail("To‘lov qayd etilgan. Shartlarni o‘zgartirish bloklangan.");
  const contract=await c.query("SELECT 1 FROM installment_contracts WHERE store_id=$1 AND order_id=$2",[store,id]);
  if(contract.rowCount)return await fail("Nasiya shartnomasi mavjud");
  await c.query("INSERT INTO order_payment_terms(store_id,order_id,agreed_total_uzs,payment_type,initial_due_uzs) VALUES($1,$2,$3,$4,$5) ON CONFLICT(store_id,order_id) DO UPDATE SET agreed_total_uzs=EXCLUDED.agreed_total_uzs,payment_type=EXCLUDED.payment_type,initial_due_uzs=EXCLUDED.initial_due_uzs",[store,id,b.total,b.type,b.initial]);
  event="payment_terms_saved";
 }else if(action==="receipt"){
  if(!t)return await fail("Avval to‘lov shartlarini saqlang");
  const dateCheck=await c.query("SELECT $1::date <= (now() AT TIME ZONE 'Asia/Tashkent')::date AS valid",[b.date]);
  if(!dateCheck.rows[0].valid)return await fail("Kelajakdagi to‘lovni olingan deb qayd etib bo‘lmaydi",400);
  const duplicate=await c.query("SELECT id,order_id,amount_uzs::text,method,received_on::text FROM order_manual_receipts WHERE store_id=$1 AND idempotency_key=$2",[store,b.key]);
  if(duplicate.rowCount){const d=duplicate.rows[0];await c.query("ROLLBACK");return d.order_id===id&&d.amount_uzs===b.amount&&d.method===b.method&&d.received_on===b.date?reply({id:d.id,repeated:true}):reply({error:"So‘rov kaliti band"},409);}
  const balance=await c.query("SELECT COALESCE(SUM(r.amount_uzs),0)::text AS received FROM order_manual_receipts r LEFT JOIN order_receipt_reversals v ON v.store_id=r.store_id AND v.receipt_id=r.id WHERE r.store_id=$1 AND r.order_id=$2 AND v.receipt_id IS NULL",[store,id]);
  const cap=BigInt(t.payment_type==="cash"?t.agreed_total_uzs:t.initial_due_uzs);
  if(BigInt(balance.rows[0].received)+BigInt(String(b.amount))>cap)return await fail("To‘lov ruxsat etilgan qoldiqdan oshmoqda");
  const result=await c.query("INSERT INTO order_manual_receipts(store_id,order_id,amount_uzs,kind,method,received_on,idempotency_key,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(store_id,idempotency_key) DO NOTHING RETURNING id",[store,id,b.amount,t.payment_type==="cash"?"cash":"initial",b.method,b.date,b.key,member.account_id]);
  if(!result.rowCount)return await fail("So‘rov takrorlandi. Yangilang.");
  event="manual_receipt_recorded";
 }else{
  const receipt=await c.query("SELECT id FROM order_manual_receipts WHERE store_id=$1 AND order_id=$2 AND id=$3",[store,id,b.receiptId]);
  if(!receipt.rowCount)return await fail("To‘lov topilmadi",404);
  const result=await c.query("INSERT INTO order_receipt_reversals(store_id,receipt_id,reversed_by,reason) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING receipt_id",[store,b.receiptId,member.account_id,String(b.reason).trim()]);
  if(!result.rowCount)return await fail("To‘lov avval bekor qilingan");
  event="manual_receipt_reversed";
 }
 await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,$3,'order',$4)",[store,member.account_id,event,id]);
 await c.query("COMMIT");return reply({ok:true},201);
 }catch{await c.query("ROLLBACK");return reply({error:"Saqlash imkoni bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
