import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../../../lib/server/db";
import {requireStoreRole} from "../../../../../../lib/server/auth";
import {isUuid,sameOrigin,smallJson,privateHeaders} from "../../../../../../lib/server/http";
import {buildSchedule,validDate} from "../../../../../../lib/installment-schedule";
import {postMonthlyAllocation,validateMonthlyReversal} from "../../../../../../lib/server/monthly-posting";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
type Ctx={params:Promise<{id:string}>};
const amount=(v:unknown):v is string=>typeof v==="string"&&/^[1-9][0-9]{0,8}$/.test(v);
export async function GET(_request:Request,{params}:Ctx){
 try{
 const {id}=await params;if(!isUuid(id))return reply({error:"Buyurtma topilmadi"},404);
 const store=configuredStoreId();const actor=await requireStoreRole(store,["owner","admin","seller"]);if(!actor)return reply({error:"Ruxsat yo‘q"},403);
 const c=await database().connect();
 try{
 await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 const o=await c.query("SELECT o.id,o.request_status,COALESCE(c.passport_cipher IS NOT NULL,false) AS has_passport FROM orders o LEFT JOIN customers c ON c.store_id=o.store_id AND c.id=o.customer_record_id WHERE o.store_id=$1 AND o.id=$2",[store,id]);
 if(!o.rowCount){await c.query("ROLLBACK");return reply({error:"Buyurtma topilmadi"},404);}
 const t=await c.query("SELECT agreed_total_uzs::text,initial_due_uzs::text,payment_type,term_months FROM order_payment_terms WHERE store_id=$1 AND order_id=$2",[store,id]);
 const paid=await c.query("SELECT COALESCE(SUM(r.amount_uzs),0)::text AS amount FROM order_manual_receipts r LEFT JOIN order_receipt_reversals v ON v.store_id=r.store_id AND v.receipt_id=r.id WHERE r.store_id=$1 AND r.order_id=$2 AND r.kind='initial' AND v.receipt_id IS NULL",[store,id]);
 const contract=await c.query("SELECT id,status FROM installment_contracts WHERE store_id=$1 AND order_id=$2",[store,id]);
 const cid=contract.rows[0]?.id;
 const schedule=cid?await c.query(`SELECT s.id,s.sequence_no,s.due_date::text,s.amount_uzs::text,COALESCE(SUM(r.amount_uzs) FILTER(WHERE v.receipt_id IS NULL),0)::text AS paid_uzs,
 CASE WHEN COALESCE(SUM(r.amount_uzs) FILTER(WHERE v.receipt_id IS NULL),0)>=s.amount_uzs THEN 'paid' WHEN s.due_date < (now() AT TIME ZONE 'Asia/Tashkent')::date THEN 'overdue' ELSE 'pending' END AS state
 FROM installment_schedule s LEFT JOIN installment_receipts r ON r.store_id=s.store_id AND r.schedule_id=s.id LEFT JOIN installment_receipt_reversals v ON v.store_id=r.store_id AND v.receipt_id=r.id
 WHERE s.store_id=$1 AND s.contract_id=$2 GROUP BY s.id ORDER BY s.sequence_no`,[store,cid]):{rows:[]};
 const receipts=cid?await c.query("SELECT r.id,s.sequence_no,r.amount_uzs::text,r.received_on::text,r.method,(SELECT SUM(a.principal_uzs)::text FROM investor_monthly_allocations a WHERE a.store_id=r.store_id AND a.receipt_id=r.id) AS principal_uzs,(SELECT SUM(a.profit_uzs)::text FROM investor_monthly_allocations a WHERE a.store_id=r.store_id AND a.receipt_id=r.id) AS profit_uzs,(v.receipt_id IS NOT NULL) AS reversed FROM installment_receipts r JOIN installment_schedule s ON s.store_id=r.store_id AND s.id=r.schedule_id LEFT JOIN installment_receipt_reversals v ON v.store_id=r.store_id AND v.receipt_id=r.id WHERE s.store_id=$1 AND s.contract_id=$2 ORDER BY r.received_at DESC",[store,cid]):{rows:[]};
 await c.query("COMMIT");
 return reply({can_review:actor.role==="admin"||actor.role==="owner",terms:t.rows[0]??null,initial_received_uzs:paid.rows[0].amount,has_passport:o.rows[0].has_passport,contract:contract.rows[0]??null,schedule:schedule.rows,receipts:receipts.rows});
 }catch{await c.query("ROLLBACK");return reply({error:"Nasiya jadvalini yuklab bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
export async function POST(request:Request,{params}:Ctx){
 if(!sameOrigin(request))return reply({error:"Ruxsat yo‘q"},403);
 const {id}=await params;const b=await smallJson(request);if(!isUuid(id)||!b)return reply({error:"Ma’lumotlarni tekshiring"},400);
 const action=b.action;
 if(action==="activate"){
 if(typeof b.months!=="number"||!Number.isSafeInteger(b.months)||b.months<1||b.months>60||!validDate(b.firstDate))return reply({error:"Muddat va sanani tekshiring"},400);
 }else if(action==="receipt"){
 if(!isUuid(b.scheduleId)||!isUuid(b.key)||!amount(b.amount)||!validDate(b.date)||!["cash","transfer","other"].includes(String(b.method)))return reply({error:"To‘lov ma’lumotlarini tekshiring"},400);
 }else if(action==="reverse"){
 if(!isUuid(b.receiptId)||typeof b.reason!=="string"||b.reason.trim().length<3||b.reason.length>240)return reply({error:"Sababni kiriting"},400);
 }else return reply({error:"Noma’lum amal"},400);
 try{
 const store=configuredStoreId();const member=await requireStoreRole(store,action==="reverse"?["owner","admin"]:["owner","admin","seller"]);if(!member)return reply({error:"Ruxsat yo‘q"},403);
 const c=await database().connect();
 try{
 await c.query("BEGIN");
 const fail=async(error:string,status=409)=>{await c.query("ROLLBACK");return reply({error},status);};
 const o=await c.query("SELECT request_status,sale_status,customer_record_id FROM orders WHERE store_id=$1 AND id=$2 FOR UPDATE",[store,id]);
 if(!o.rowCount)return await fail("Buyurtma topilmadi",404);
 if(o.rows[0].request_status==="cancelled")return await fail("Buyurtma bekor qilingan");
 const contract=await c.query("SELECT id,status FROM installment_contracts WHERE store_id=$1 AND order_id=$2",[store,id]);
 const existing=contract.rows[0];let event:string;
 if(action==="activate"){
 if(process.env.INSTALLMENT_SCHEDULE_ENABLED!=="true")return await fail("Nasiya jadvali hali yoqilmagan",503);
 if(existing)return await fail("Nasiya jadvali mavjud");
 const t=await c.query("SELECT agreed_total_uzs,initial_due_uzs,payment_type,term_months FROM order_payment_terms WHERE store_id=$1 AND order_id=$2",[store,id]);
 const terms=t.rows[0];if(!terms||terms.payment_type!=="installment"||!terms.term_months)return await fail("Avval hisoblangan nasiya shartlarini saqlang");
 if(terms.term_months!==b.months)return await fail("Muddat saqlangan nasiya shartlariga mos emas",400);
 const customer=await c.query("SELECT id FROM customers WHERE store_id=$1 AND id=$2 AND passport_cipher IS NOT NULL",[store,o.rows[0].customer_record_id]);
 if(!customer.rowCount)return await fail("Pasport ma’lumoti mavjud mijozni biriktiring");
 const initial=await c.query("SELECT COALESCE(SUM(r.amount_uzs),0)::text AS paid FROM order_manual_receipts r LEFT JOIN order_receipt_reversals v ON v.store_id=r.store_id AND v.receipt_id=r.id WHERE r.store_id=$1 AND r.order_id=$2 AND r.kind='initial' AND v.receipt_id IS NULL",[store,id]);
 if(BigInt(initial.rows[0].paid)!==BigInt(terms.initial_due_uzs))return await fail("Kelishilgan boshlang‘ich to‘lov to‘liq qayd etilishi kerak");
 let schedule;try{schedule=buildSchedule(BigInt(terms.agreed_total_uzs),BigInt(terms.initial_due_uzs),Number(b.months),String(b.firstDate));}catch{return await fail("Jadval summasi yoki muddati noto‘g‘ri",400);}
 const result=await c.query("INSERT INTO installment_contracts(store_id,order_id,contract_total_uzs,initial_payment_uzs,status) VALUES($1,$2,$3,$4,'active') RETURNING id",[store,id,terms.agreed_total_uzs,terms.initial_due_uzs]);
 for(const s of schedule)await c.query("INSERT INTO installment_schedule(store_id,contract_id,sequence_no,due_date,amount_uzs) VALUES($1,$2,$3,$4,$5)",[store,result.rows[0].id,s.sequence_no,s.due_date,s.amount_uzs]);
 event="installment_schedule_activated";
 }else{
 if(!existing||!["active","settled"].includes(existing.status))return await fail("Faol nasiya jadvali mavjud emas");
 if(action==="receipt"){
 const duplicate=await c.query("SELECT r.id,r.schedule_id,r.amount_uzs::text,r.method,r.received_on::text FROM installment_receipts r JOIN installment_schedule s ON s.store_id=r.store_id AND s.id=r.schedule_id WHERE r.store_id=$1 AND r.idempotency_key=$2 AND s.contract_id=$3",[store,b.key,existing.id]);
 if(duplicate.rowCount){const d=duplicate.rows[0];await c.query("ROLLBACK");return d.schedule_id===b.scheduleId&&d.amount_uzs===b.amount&&d.method===b.method&&d.received_on===b.date?reply({id:d.id,repeated:true}):reply({error:"So‘rov kaliti band"},409);}
 if(existing.status!=="active")return await fail("Nasiya yakunlangan");
 const date=await c.query("SELECT $1::date <= (now() AT TIME ZONE 'Asia/Tashkent')::date AS valid",[b.date]);if(!date.rows[0].valid)return await fail("Kelajakdagi to‘lovni qayd etib bo‘lmaydi",400);
 const s=await c.query("SELECT s.amount_uzs,COALESCE(SUM(r.amount_uzs) FILTER(WHERE v.receipt_id IS NULL),0)::text AS paid FROM installment_schedule s LEFT JOIN installment_receipts r ON r.store_id=s.store_id AND r.schedule_id=s.id LEFT JOIN installment_receipt_reversals v ON v.store_id=r.store_id AND v.receipt_id=r.id WHERE s.store_id=$1 AND s.contract_id=$2 AND s.id=$3 GROUP BY s.id",[store,existing.id,b.scheduleId]);
 if(!s.rowCount)return await fail("To‘lov qatori topilmadi",404);
 if(BigInt(s.rows[0].paid)+BigInt(String(b.amount))>BigInt(s.rows[0].amount_uzs))return await fail("To‘lov jadvaldagi qoldiqdan oshmoqda");
 const result=await c.query("INSERT INTO installment_receipts(store_id,schedule_id,amount_uzs,idempotency_key,recorded_by,received_on,method) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(store_id,idempotency_key) DO NOTHING RETURNING id",[store,b.scheduleId,b.amount,b.key,member.account_id,b.date,b.method]);
 if(!result.rowCount)return await fail("Takroriy so‘rov");
 // A sold order's funding is frozen. Capture original invested amounts, never current portfolio balances.
 if(o.rows[0].sale_status==="sold"){
   await c.query(`WITH participants AS (
     SELECT investor_account_id,amount_uzs,sum(amount_uzs) OVER () AS funded
     FROM order_funding_allocations WHERE store_id=$1 AND order_id=$2
   )
   INSERT INTO installment_receipt_funding_weights(store_id,receipt_id,investor_account_id,invested_uzs)
   SELECT $1,$3,p.investor_account_id,p.amount_uzs FROM participants p
   JOIN order_payment_terms t ON t.store_id=$1 AND t.order_id=$2 AND t.cost_uzs=p.funded`,
   [store,id,result.rows[0].id]);
 }
 const postingError=await postMonthlyAllocation(c,store,id,result.rows[0].id,BigInt(String(b.amount)));
 if(postingError)return await fail(postingError);
 event="installment_receipt_recorded";
 }else{
 const r=await c.query("SELECT r.id FROM installment_receipts r JOIN installment_schedule s ON s.store_id=r.store_id AND s.id=r.schedule_id WHERE r.store_id=$1 AND s.contract_id=$2 AND r.id=$3",[store,existing.id,b.receiptId]);
 if(!r.rowCount)return await fail("To‘lov topilmadi",404);
 const reversal=await c.query("INSERT INTO installment_receipt_reversals(store_id,receipt_id,reversed_by,reason) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING receipt_id",[store,b.receiptId,member.account_id,String(b.reason).trim()]);
 if(!reversal.rowCount)return await fail("To‘lov avval bekor qilingan");const issue=await validateMonthlyReversal(c,store,id,String(b.receiptId));
 if(issue)return await fail(issue);
 await c.query("UPDATE receipt_reviews SET resolved_at=now(),resolved_by=$3,resolution=$4 WHERE store_id=$1 AND monthly_id=$2 AND resolved_at IS NULL",[store,b.receiptId,member.account_id,b.reason]);
 event="installment_receipt_reversed";
 }
 await c.query(`UPDATE installment_contracts c SET status=CASE WHEN NOT EXISTS(
 SELECT 1 FROM installment_schedule s LEFT JOIN installment_receipts r ON r.store_id=s.store_id AND r.schedule_id=s.id LEFT JOIN installment_receipt_reversals v ON v.store_id=r.store_id AND v.receipt_id=r.id WHERE s.store_id=c.store_id AND s.contract_id=c.id GROUP BY s.id HAVING COALESCE(SUM(r.amount_uzs) FILTER(WHERE v.receipt_id IS NULL),0)<s.amount_uzs
 ) THEN 'settled' ELSE 'active' END WHERE c.store_id=$1 AND c.id=$2`,[store,existing.id]);
 }
 await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,$3,'order',$4)",[store,member.account_id,event,id]);await c.query("COMMIT");return reply({ok:true},201);
 }catch{await c.query("ROLLBACK");return reply({error:"Saqlash imkoni bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
