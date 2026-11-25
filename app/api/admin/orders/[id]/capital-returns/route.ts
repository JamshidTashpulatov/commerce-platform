import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../../../lib/server/db";
import {requireStoreRole} from "../../../../../../lib/server/auth";
import {isUuid,sameOrigin,smallJson,privateHeaders} from "../../../../../../lib/server/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{id:string}>};
type Entry={accountId:string;amount:string};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
export async function GET(_request:Request,{params}:Ctx){
 try{
 const {id}=await params;if(!isUuid(id))return reply({error:"Buyurtma topilmadi"},404);
 const store=configuredStoreId();const member=await requireStoreRole(store,["owner","admin","seller"]);if(!member)return reply({error:"Ruxsat yo‘q"},403);
 const c=await database().connect();
 try{
 await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 const order=await c.query("SELECT o.sale_status,t.cost_uzs::text AS cost FROM orders o LEFT JOIN order_payment_terms t ON t.store_id=o.store_id AND t.order_id=o.id WHERE o.store_id=$1 AND o.id=$2",[store,id]);
 if(!order.rowCount){await c.query("ROLLBACK");return reply({error:"Buyurtma topilmadi"},404);}
 const allocations=await c.query("SELECT a.investor_account_id AS account_id,COALESCE(p.display_name,'Investor '||left(a.investor_account_id::text,8)) AS name,a.amount_uzs::text,a.returned_uzs::text,a.outstanding_uzs::text FROM investor_funding_balances a LEFT JOIN investor_profiles p ON p.store_id=a.store_id AND p.account_id=a.investor_account_id WHERE a.store_id=$1 AND a.order_id=$2 ORDER BY a.investor_account_id",[store,id]);
 const receipts=await c.query("SELECT r.id,r.amount_uzs::text,r.received_on::text,EXISTS(SELECT 1 FROM investor_initial_returns i WHERE i.store_id=r.store_id AND i.receipt_id=r.id) AS posted FROM order_manual_receipts r LEFT JOIN order_receipt_reversals v ON v.store_id=r.store_id AND v.receipt_id=r.id WHERE r.store_id=$1 AND r.order_id=$2 AND r.kind='initial' AND v.receipt_id IS NULL ORDER BY r.created_at,r.id",[store,id]);
 await c.query("COMMIT");return reply({cost:order.rows[0].cost,sold:order.rows[0].sale_status==="sold",allocations:allocations.rows,receipts:receipts.rows,canPost:member.role!=="seller"&&process.env.INVESTOR_FUNDING_ENABLED==="true"});
 }catch{await c.query("ROLLBACK");return reply({error:"Kapital qaytimini yuklab bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
export async function POST(request:Request,{params}:Ctx){
 if(!sameOrigin(request))return reply({error:"Ruxsat yo‘q"},403);
 const {id}=await params;const b=await smallJson(request);
 if(!isUuid(id)||!b||!isUuid(b.receiptId)||!Array.isArray(b.entries)||b.entries.length<1||b.entries.length>20)return reply({error:"Qaytim ma’lumotlarini tekshiring"},400);
 const entries:Entry[]=[];
 for(const e of b.entries){if(!e||typeof e!=="object"||!isUuid(e.accountId)||typeof e.amount!=="string"||!/^[1-9][0-9]{0,11}$/.test(e.amount))return reply({error:"Investor va summani tekshiring"},400);entries.push({accountId:e.accountId.toLowerCase(),amount:e.amount});}
 if(new Set(entries.map(e=>e.accountId)).size!==entries.length)return reply({error:"Investor takrorlangan"},400);
 try{
 const store=configuredStoreId();const member=await requireStoreRole(store,["owner","admin"]);if(!member)return reply({error:"Ruxsat yo‘q"},403);
 if(process.env.INVESTOR_FUNDING_ENABLED!=="true")return reply({error:"Moliyalashtirish hali yoqilmagan"},503);
 const c=await database().connect();
 try{
 await c.query("BEGIN");
 const fail=async(error:string,status=409)=>{await c.query("ROLLBACK");return reply({error},status);};
 const o=await c.query("SELECT sale_status,request_status FROM orders WHERE store_id=$1 AND id=$2 FOR UPDATE",[store,id]);
 if(!o.rowCount)return await fail("Buyurtma topilmadi",404);
 if(o.rows[0].sale_status!=="sold"||o.rows[0].request_status==="cancelled")return await fail("Avval sotuvni tasdiqlang");
 const receipt=await c.query("SELECT r.amount_uzs FROM order_manual_receipts r LEFT JOIN order_receipt_reversals v ON v.store_id=r.store_id AND v.receipt_id=r.id WHERE r.store_id=$1 AND r.order_id=$2 AND r.id=$3 AND r.kind='initial' AND v.receipt_id IS NULL",[store,id,b.receiptId]);
 if(!receipt.rowCount)return await fail("Amaldagi boshlang‘ich to‘lov topilmadi",404);
 const prior=await c.query("SELECT investor_account_id,amount_uzs::text FROM investor_initial_returns WHERE store_id=$1 AND receipt_id=$2",[store,b.receiptId]);
 if(prior.rowCount){const matches=prior.rows.length===entries.length&&entries.every(e=>prior.rows.some(p=>p.investor_account_id===e.accountId&&p.amount_uzs===e.amount));await c.query("ROLLBACK");return matches?reply({ok:true,repeated:true}):reply({error:"To‘lov allaqachon taqsimlangan"},409);}
 const t=await c.query("SELECT cost_uzs FROM order_payment_terms WHERE store_id=$1 AND order_id=$2 AND payment_type='installment'",[store,id]);
 const allocations=await c.query("SELECT investor_account_id,amount_uzs,outstanding_uzs FROM investor_funding_balances WHERE store_id=$1 AND order_id=$2 ORDER BY investor_account_id",[store,id]);
 const total=allocations.rows.reduce((n,r)=>n+BigInt(r.amount_uzs),BigInt(0));
 if(!t.rows[0]?.cost_uzs||total!==BigInt(t.rows[0].cost_uzs))return await fail("To‘liq tan narxi investorlar hisobidan moliyalashtirilgan bo‘lishi kerak");
 if(entries.reduce((n,e)=>n+BigInt(e.amount),BigInt(0))!==BigInt(receipt.rows[0].amount_uzs))return await fail("Taqsimot to‘lov summasiga teng bo‘lishi kerak",400);
 for(const a of allocations.rows){
 const lock=await c.query("SELECT role FROM memberships WHERE store_id=$1 AND account_id=$2 FOR UPDATE",[store,a.investor_account_id]);
 if(lock.rows[0]?.role!=="investor")return await fail("Investor hisobi mavjud emas");
 }
 for(const e of entries){
 const a=allocations.rows.find(r=>r.investor_account_id===e.accountId);
 if(!a||BigInt(e.amount)>BigInt(a.outstanding_uzs))return await fail("Qaytim investorning aylanmadagi kapitalidan oshmoqda",400);
 await c.query("INSERT INTO investor_initial_returns(store_id,order_id,receipt_id,investor_account_id,amount_uzs,recorded_by) VALUES($1,$2,$3,$4,$5,$6)",[store,id,b.receiptId,e.accountId,e.amount,member.account_id]);
 }
 await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'initial_capital_return_posted','order',$3)",[store,member.account_id,id]);
 await c.query("COMMIT");return reply({ok:true},201);
 }catch{await c.query("ROLLBACK");return reply({error:"Kapital qaytimi saqlanmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
