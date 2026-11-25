import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../../../lib/server/db";
import {requireStoreRole} from "../../../../../../lib/server/auth";
import {isUuid,sameOrigin,smallJson,privateHeaders} from "../../../../../../lib/server/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
type Ctx={params:Promise<{id:string}>};
type Allocation={accountId:string;amount:string};
export async function GET(_request:Request,{params}:Ctx){
 try{
 const {id}=await params;if(!isUuid(id))return reply({error:"Buyurtma topilmadi"},404);
 const store=configuredStoreId();const viewer=await requireStoreRole(store,["owner","admin","seller"]);if(!viewer)return reply({error:"Ruxsat yo‘q"},403);
 const c=await database().connect();
 try{
 await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 const o=await c.query("SELECT o.request_status,t.cost_uzs::text AS principal FROM orders o LEFT JOIN order_payment_terms t ON t.store_id=o.store_id AND t.order_id=o.id WHERE o.store_id=$1 AND o.id=$2",[store,id]);
 if(!o.rowCount){await c.query("ROLLBACK");return reply({error:"Buyurtma topilmadi"},404);}
 const allocations=await c.query("SELECT investor_account_id AS account_id,amount_uzs::text FROM order_funding_allocations WHERE store_id=$1 AND order_id=$2 ORDER BY investor_account_id",[store,id]);
 const investors=await c.query(`
 SELECT m.account_id,COALESCE(p.display_name,'Investor '||left(m.account_id::text,8)) AS name,
 (COALESCE((SELECT SUM(CASE event_type WHEN 'contribution' THEN amount_uzs WHEN 'withdrawal' THEN -amount_uzs ELSE 0 END) FROM investor_capital_events e WHERE e.store_id=m.store_id AND e.investor_account_id=m.account_id),0)
 -COALESCE((SELECT SUM(a.outstanding_uzs) FROM investor_funding_balances a WHERE a.store_id=m.store_id AND a.investor_account_id=m.account_id AND a.order_id<>$2),0))::text AS available_for_order_uzs
 FROM memberships m LEFT JOIN investor_profiles p ON p.store_id=m.store_id AND p.account_id=m.account_id WHERE m.store_id=$1 AND m.role='investor' ORDER BY name LIMIT 200`,[store,id]);
 await c.query("COMMIT");return reply({principal:o.rows[0].principal,allocations:allocations.rows,investors:investors.rows,enabled:process.env.INVESTOR_FUNDING_ENABLED==="true",can_assign:viewer.role!=="seller"});
 }catch{await c.query("ROLLBACK");return reply({error:"Moliyalashtirishni yuklab bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
export async function PUT(request:Request,{params}:Ctx){
 if(!sameOrigin(request))return reply({error:"Ruxsat yo‘q"},403);
 const {id}=await params;const b=await smallJson(request);
 if(!isUuid(id)||!b||!Array.isArray(b.allocations)||b.allocations.length>20)return reply({error:"Investorlarni tekshiring"},400);
 const allocations:Allocation[]=[];
 for(const a of b.allocations){
 if(!a||typeof a!=="object"||!isUuid(a.accountId)||typeof a.amount!=="string"||!/^[1-9][0-9]{0,8}$/.test(a.amount))return reply({error:"Investor va summani tekshiring"},400);
 allocations.push({accountId:a.accountId.toLowerCase(),amount:a.amount});
 }
 if(new Set(allocations.map(a=>a.accountId)).size!==allocations.length)return reply({error:"Investor takrorlangan"},400);
 try{
 // Confirmed 2026-11-25: only the administrator (or owner) assigns investors. Sellers may read, not save.
 const store=configuredStoreId();const member=await requireStoreRole(store,["owner","admin"]);if(!member)return reply({error:"Ruxsat yo‘q"},403);
 if(process.env.INVESTOR_FUNDING_ENABLED!=="true")return reply({error:"Moliyalashtirish hali yoqilmagan"},503);
 const c=await database().connect();
 try{
 await c.query("BEGIN");
 const fail=async(error:string,status=409)=>{await c.query("ROLLBACK");return reply({error},status);};
 // All funding writes acquire the order lock first, then investor membership locks in stable order.
 const o=await c.query("SELECT request_status,sale_status FROM orders WHERE store_id=$1 AND id=$2 FOR UPDATE",[store,id]);
 if(!o.rowCount)return await fail("Buyurtma topilmadi",404);
 if(o.rows[0].request_status==="cancelled"||o.rows[0].sale_status==="sold")return await fail("Sotilgan yoki bekor qilingan buyurtmaning moliyalashtirishini o‘zgartirib bo‘lmaydi");
 // Cash and instalment orders are both funded, against the recorded cost of the product.
 const t=await c.query("SELECT cost_uzs FROM order_payment_terms WHERE store_id=$1 AND order_id=$2",[store,id]);
 if(!t.rows[0]?.cost_uzs)return await fail("Avval to‘lov shartlarida tan narxini saqlang");
 const principal=BigInt(t.rows[0].cost_uzs);
 const sum=allocations.reduce((n,a)=>n+BigInt(a.amount),BigInt(0));
 if(sum>principal)return await fail("Ajratilgan kapital mahsulotning to‘liq tan narxidan oshmoqda",400);
 // Funding covers the full cost or nothing: an empty list clears it, anything else must add up exactly.
 if(allocations.length&&sum!==principal)return await fail("Ajratilgan summalar yig‘indisi tan narxiga teng bo‘lishi kerak",400);
 const previous=await c.query("SELECT investor_account_id FROM order_funding_allocations WHERE store_id=$1 AND order_id=$2",[store,id]);
 const ids=[...new Set([...allocations.map(a=>a.accountId),...previous.rows.map(r=>String(r.investor_account_id))])].sort();
 for(const accountId of ids){
 const lock=await c.query("SELECT role FROM memberships WHERE store_id=$1 AND account_id=$2 FOR UPDATE",[store,accountId]);
 const entry=allocations.find(a=>a.accountId===accountId);
 if(!entry)continue;
 if(lock.rows[0]?.role!=="investor")return await fail("Investor topilmadi",404);
 const available=await c.query(`
 SELECT (COALESCE((SELECT SUM(CASE event_type WHEN 'contribution' THEN amount_uzs WHEN 'withdrawal' THEN -amount_uzs ELSE 0 END) FROM investor_capital_events WHERE store_id=$1 AND investor_account_id=$2),0)
 -COALESCE((SELECT SUM(outstanding_uzs) FROM investor_funding_balances WHERE store_id=$1 AND investor_account_id=$2 AND order_id<>$3),0))::text AS value`,[store,accountId,id]);
 if(BigInt(entry.amount)>BigInt(available.rows[0].value))return await fail("Investor kapitali yetarli emas");
 }
 await c.query("DELETE FROM order_funding_allocations WHERE store_id=$1 AND order_id=$2",[store,id]);
 for(const a of allocations)await c.query("INSERT INTO order_funding_allocations(store_id,order_id,investor_account_id,amount_uzs) VALUES($1,$2,$3,$4)",[store,id,a.accountId,a.amount]);
 await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'funding_allocations_saved','order',$3)",[store,member.account_id,id]);
 await c.query("COMMIT");return reply({ok:true});
 }catch{await c.query("ROLLBACK");return reply({error:"Saqlash imkoni bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
