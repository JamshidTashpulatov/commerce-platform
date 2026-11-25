import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../../../lib/server/db";
import {requireStoreRole} from "../../../../../../lib/server/auth";
import {isUuid,privateHeaders} from "../../../../../../lib/server/http";
import {allocateProportionally} from "../../../../../../lib/profit-split";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
type Ctx={params:Promise<{id:string}>};
const zero=BigInt(0);

// Read-only: who funded this order and what has come back to each of them so far.
// Staff only (owner, admin, seller). Investors have their own endpoints and never read this one.
export async function GET(_request:Request,{params}:Ctx){
 try{
 const {id}=await params;if(!isUuid(id))return reply({error:"Buyurtma topilmadi"},404);
 const store=configuredStoreId();const viewer=await requireStoreRole(store,["owner","admin","seller"]);if(!viewer)return reply({error:"Ruxsat yo‘q"},403);
 const c=await database().connect();
 try{
 await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 const o=await c.query("SELECT t.cost_uzs::text AS cost,t.payment_type FROM orders o LEFT JOIN order_payment_terms t ON t.store_id=o.store_id AND t.order_id=o.id WHERE o.store_id=$1 AND o.id=$2",[store,id]);
 if(!o.rowCount){await c.query("ROLLBACK");return reply({error:"Buyurtma topilmadi"},404);}
 const rows=await c.query(`
  SELECT a.investor_account_id AS account_id,COALESCE(p.display_name,'Investor '||left(a.investor_account_id::text,8)) AS name,
   a.amount_uzs::text AS invested,
   (SELECT COALESCE(SUM(i.amount_uzs),0) FROM investor_initial_returns i WHERE i.store_id=a.store_id AND i.order_id=a.order_id AND i.investor_account_id=a.investor_account_id
     AND NOT EXISTS(SELECT 1 FROM order_receipt_reversals v WHERE v.store_id=i.store_id AND v.receipt_id=i.receipt_id))::text AS initial_returned,
   (SELECT COALESCE(SUM(m.principal_uzs),0) FROM active_monthly_allocations m WHERE m.store_id=a.store_id AND m.order_id=a.order_id AND m.investor_account_id=a.investor_account_id)::text AS monthly_principal,
   (SELECT COALESCE(SUM(m.profit_uzs),0) FROM active_monthly_allocations m WHERE m.store_id=a.store_id AND m.order_id=a.order_id AND m.investor_account_id=a.investor_account_id)::text AS profit
  FROM order_funding_allocations a LEFT JOIN investor_profiles p ON p.store_id=a.store_id AND p.account_id=a.investor_account_id
  WHERE a.store_id=$1 AND a.order_id=$2 ORDER BY a.amount_uzs DESC,name,a.investor_account_id`,[store,id]);
 await c.query("COMMIT");
 const cost=o.rows[0].cost?BigInt(o.rows[0].cost):null;
 const funded=rows.rows.reduce((n,r)=>n+BigInt(r.invested),zero);
 const initial=rows.rows.reduce((n,r)=>n+BigInt(r.initial_returned),zero);
 // What each investor should have received from the initial payment: proportional to funding, whole dollars.
 const expected=funded>zero&&initial>zero?new Map(allocateProportionally(initial,rows.rows.map(r=>({investorId:r.account_id as string,capital:BigInt(r.invested)}))).map(x=>[x.investorId,x.amount])):null;
 // Off by a dollar or more from the exact proportion: the monthly posting would refuse the next payment.
 const off=(r:{invested:string;initial_returned:string})=>{const d=BigInt(r.initial_returned)*funded-initial*BigInt(r.invested);return d>=funded||d<=-funded;};
 const mismatch=!!expected&&rows.rows.some(off);
 const investors=rows.rows.map(r=>{
  const invested=BigInt(r.invested);
  return {account_id:r.account_id,name:r.name,invested_uzs:r.invested,
   // Share of the funding in hundredths of a percent, rounded.
   share_bps:funded>zero?Number((invested*BigInt(10000)+funded/BigInt(2))/funded):0,
   initial_returned_uzs:r.initial_returned,
   initial_expected_uzs:mismatch?expected!.get(r.account_id)!.toString():null,
   monthly_principal_uzs:r.monthly_principal,profit_uzs:r.profit,
   outstanding_uzs:(invested-BigInt(r.initial_returned)-BigInt(r.monthly_principal)).toString()};
 });
 const sum=(k:"invested_uzs"|"initial_returned_uzs"|"monthly_principal_uzs"|"profit_uzs"|"outstanding_uzs")=>investors.reduce((n,r)=>n+BigInt(r[k]),zero).toString();
 return reply({cost:cost?.toString()??null,fully_funded:cost!==null&&funded===cost,initial_mismatch:mismatch,investors,
  totals:{invested_uzs:sum("invested_uzs"),initial_returned_uzs:sum("initial_returned_uzs"),monthly_principal_uzs:sum("monthly_principal_uzs"),profit_uzs:sum("profit_uzs"),outstanding_uzs:sum("outstanding_uzs")}});
 }catch{await c.query("ROLLBACK");return reply({error:"Investorlar jadvalini yuklab bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
