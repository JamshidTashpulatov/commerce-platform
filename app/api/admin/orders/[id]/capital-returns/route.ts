import {NextResponse} from "next/server";
import type {PoolClient} from "pg";
import {database,configuredStoreId} from "../../../../../../lib/server/db";
import {requireStoreRole} from "../../../../../../lib/server/auth";
import {isUuid,sameOrigin,smallJson,privateHeaders} from "../../../../../../lib/server/http";
import {initialReturnShares,initialReturnIsProportional} from "../../../../../../lib/initial-return";
import {allocateProportionally} from "../../../../../../lib/profit-split";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{id:string}>};
type Entry={accountId:string;amount:string};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
const zero=BigInt(0);

type Funding={id:string;name:string;invested:bigint;outstanding:bigint};
type Receipt={id:string;amount:bigint;received_on:string;rows:Map<string,bigint>;created_at:Date|null};
type State={sold:boolean;cancelled:boolean;installment:boolean;cost:bigint|null;funding:Funding[];receipts:Receipt[];monthly:number};

// Everything the return rules look at, read in one place so GET and POST decide the same way.
async function readState(c:PoolClient,store:string,id:string,lock:boolean):Promise<State|null>{
 const o=await c.query("SELECT sale_status,request_status FROM orders WHERE store_id=$1 AND id=$2"+(lock?" FOR UPDATE":""),[store,id]);
 if(!o.rowCount)return null;
 const t=await c.query("SELECT cost_uzs,payment_type FROM order_payment_terms WHERE store_id=$1 AND order_id=$2",[store,id]);
 const funding=await c.query("SELECT a.investor_account_id AS id,COALESCE(p.display_name,'Investor '||left(a.investor_account_id::text,8)) AS name,a.amount_uzs,a.outstanding_uzs FROM investor_funding_balances a LEFT JOIN investor_profiles p ON p.store_id=a.store_id AND p.account_id=a.investor_account_id WHERE a.store_id=$1 AND a.order_id=$2 ORDER BY a.investor_account_id",[store,id]);
 const receipts=await c.query("SELECT r.id,r.amount_uzs,r.received_on::text FROM order_manual_receipts r LEFT JOIN order_receipt_reversals v ON v.store_id=r.store_id AND v.receipt_id=r.id WHERE r.store_id=$1 AND r.order_id=$2 AND r.kind='initial' AND v.receipt_id IS NULL ORDER BY r.created_at,r.id",[store,id]);
 const returns=await c.query("SELECT receipt_id,investor_account_id,amount_uzs,created_at FROM investor_initial_returns WHERE store_id=$1 AND order_id=$2",[store,id]);
 const monthly=await c.query("SELECT count(*)::int AS n FROM active_monthly_allocations WHERE store_id=$1 AND order_id=$2",[store,id]);
 return {
  sold:o.rows[0].sale_status==="sold",cancelled:o.rows[0].request_status==="cancelled",
  installment:t.rows[0]?.payment_type==="installment",cost:t.rows[0]?.cost_uzs?BigInt(t.rows[0].cost_uzs):null,
  funding:funding.rows.map(r=>({id:r.id,name:r.name,invested:BigInt(r.amount_uzs),outstanding:BigInt(r.outstanding_uzs)})),
  receipts:receipts.rows.map(r=>{
   const own=returns.rows.filter(x=>x.receipt_id===r.id);
   return {id:r.id,amount:BigInt(r.amount_uzs),received_on:r.received_on,rows:new Map(own.map(x=>[x.investor_account_id as string,BigInt(x.amount_uzs)])),
    created_at:own.length?own.reduce((d:Date,x)=>x.created_at<d?x.created_at:d,own[0].created_at):null};
  }),
  monthly:monthly.rows[0].n,
 };
}
const fullyFunded=(s:State)=>s.cost!==null&&s.funding.reduce((n,f)=>n+f.invested,zero)===s.cost;
const posted=(s:State)=>s.receipts.filter(r=>r.rows.size>0);
const returnedTo=(s:State,investor:string)=>posted(s).reduce((n,r)=>n+(r.rows.get(investor)??zero),zero);

// What the system would post for one not yet posted receipt: proportional to funding, on top of earlier returns.
function sharesFor(s:State,receipt:Receipt){
 const before=posted(s).reduce((n,r)=>n+r.amount,zero);
 return initialReturnShares(before+receipt.amount,s.funding.map(f=>({id:f.id,invested:f.invested,returned:returnedTo(s,f.id)})));
}

const preview=(s:State,r:Receipt)=>{try{return sharesFor(s,r).map(x=>({account_id:x.id,amount_uzs:x.share.toString()}));}catch{return null;}};

// The corrected split of the receipts that were already posted. Each investor's total is the exact
// proportion of all posted initial money; with several receipts every receipt takes its part of what
// is still owed to each investor, so the totals always come out as computed.
function proportionalPlan(s:State){
 const done=posted(s);
 const remaining=new Map(initialReturnShares(done.reduce((n,r)=>n+r.amount,zero),s.funding.map(f=>({id:f.id,invested:f.invested,returned:zero}))).map(x=>[x.id,x.total]));
 return done.map(r=>{
  const open=s.funding.filter(f=>remaining.get(f.id)!>zero);
  const parts=new Map(allocateProportionally(r.amount,open.map(f=>({investorId:f.id,capital:remaining.get(f.id)!}))).map(x=>[x.investorId,x.amount]));
  const shares=s.funding.map(f=>({id:f.id,share:parts.get(f.id)??zero}));
  for(const x of shares)remaining.set(x.id,remaining.get(x.id)!-x.share);
  return {receipt:r,shares};
 });
}

// A correction is offered only when a hand-typed split is materially off the proportion, and is safe only
// while nothing depends on it: no monthly payment was posted and the capital returned in excess is still free.
async function correctionFor(c:PoolClient,store:string,s:State){
 const done=posted(s);
 if(!s.sold||s.cancelled||!s.installment||!fullyFunded(s)||!done.length)return null;
 const initial=done.reduce((n,r)=>n+r.amount,zero);
 const current=s.funding.map(f=>({...f,returned:returnedTo(s,f.id)}));
 if(initialReturnIsProportional(initial,s.cost!,current))return null;
 const plan=proportionalPlan(s);
 const rows=current.map(f=>({account_id:f.id,name:f.name,invested:f.invested,current:f.returned,
  target:plan.reduce((n,p)=>n+p.shares.find(x=>x.id===f.id)!.share,zero)}));
 let reason:string|null=null;
 if(s.monthly>0)reason="Bu buyurtma bo‘yicha oylik to‘lov qabul qilingan. Tuzatishdan oldin oylik to‘lov qaydlarini bekor qilish kerak.";
 else for(const r of rows){
  if(r.current<=r.target)continue;
  const free=await c.query(`SELECT ((SELECT COALESCE(SUM(CASE event_type WHEN 'contribution' THEN amount_uzs WHEN 'withdrawal' THEN -amount_uzs ELSE 0 END),0)
     FROM investor_capital_events WHERE store_id=$1 AND investor_account_id=$2)
   -(SELECT COALESCE(SUM(outstanding_uzs),0) FROM investor_funding_balances WHERE store_id=$1 AND investor_account_id=$2))::text AS free`,[store,r.account_id]);
  if(BigInt(free.rows[0].free)<r.current-r.target){reason=`${r.name}ga ortiqcha qaytarilgan kapital boshqa mahsulotga ajratilgan yoki yechib olingan. Avval shu mablag‘ni bo‘shating.`;break;}
 }
 return {plan,rows,reason};
}

export async function GET(_request:Request,{params}:Ctx){
 try{
 const {id}=await params;if(!isUuid(id))return reply({error:"Buyurtma topilmadi"},404);
 const store=configuredStoreId();const member=await requireStoreRole(store,["owner","admin","seller"]);if(!member)return reply({error:"Ruxsat yo‘q"},403);
 const c=await database().connect();
 try{
 await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 const s=await readState(c,store,id,false);
 if(!s){await c.query("ROLLBACK");return reply({error:"Buyurtma topilmadi"},404);}
 const ready=s.sold&&!s.cancelled&&s.installment&&fullyFunded(s);
 const correction=await correctionFor(c,store,s);
 await c.query("COMMIT");
 const canPost=member.role!=="seller"&&process.env.INVESTOR_FUNDING_ENABLED==="true";
 return reply({cost:s.cost?.toString()??null,sold:s.sold,canPost,
  allocations:s.funding.map(f=>({account_id:f.id,name:f.name,amount_uzs:f.invested.toString(),returned_uzs:(f.invested-f.outstanding).toString(),outstanding_uzs:f.outstanding.toString()})),
  receipts:s.receipts.map(r=>({id:r.id,amount_uzs:r.amount.toString(),received_on:r.received_on,posted:r.rows.size>0,
   // Read-only: the shares the system will post when the administrator confirms.
   shares:ready&&!r.rows.size?preview(s,r):null})),
  correction:correction&&{allowed:canPost&&!correction.reason,reason:correction.reason,
   rows:correction.rows.map(r=>({account_id:r.account_id,name:r.name,amount_uzs:r.invested.toString(),current_uzs:r.current.toString(),target_uzs:r.target.toString()}))}});
 }catch{await c.query("ROLLBACK");return reply({error:"Kapital qaytimini yuklab bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
export async function POST(request:Request,{params}:Ctx){
 if(!sameOrigin(request))return reply({error:"Ruxsat yo‘q"},403);
 const {id}=await params;const b=await smallJson(request);
 if(!isUuid(id)||!b)return reply({error:"Qaytim ma’lumotlarini tekshiring"},400);
 const rebalance=b.action==="rebalance";
 // `entries` is optional and only a cross-check: the server computes the shares and refuses any other split.
 let entries:Entry[]|null=null;
 if(!rebalance){
  if(!isUuid(b.receiptId))return reply({error:"Qaytim ma’lumotlarini tekshiring"},400);
  if(b.entries!==undefined){
   if(!Array.isArray(b.entries)||b.entries.length<1||b.entries.length>20)return reply({error:"Qaytim ma’lumotlarini tekshiring"},400);
   entries=[];
   for(const e of b.entries){if(!e||typeof e!=="object"||!isUuid(e.accountId)||typeof e.amount!=="string"||!/^[1-9][0-9]{0,8}$/.test(e.amount))return reply({error:"Investor va summani tekshiring"},400);entries.push({accountId:e.accountId.toLowerCase(),amount:e.amount});}
   if(new Set(entries.map(e=>e.accountId)).size!==entries.length)return reply({error:"Investor takrorlangan"},400);
  }
 }
 try{
 const store=configuredStoreId();const member=await requireStoreRole(store,["owner","admin"]);if(!member)return reply({error:"Ruxsat yo‘q"},403);
 if(process.env.INVESTOR_FUNDING_ENABLED!=="true")return reply({error:"Moliyalashtirish hali yoqilmagan"},503);
 const c=await database().connect();
 try{
 await c.query("BEGIN");
 const fail=async(error:string,status=409)=>{await c.query("ROLLBACK");return reply({error},status);};
 let s=await readState(c,store,id,true);
 if(!s)return await fail("Buyurtma topilmadi",404);
 if(!s.sold||s.cancelled)return await fail("Avval sotuvni tasdiqlang");
 // Investor rows are locked in one order, then the balances are read again under the locks.
 for(const f of s.funding){
  const lock=await c.query("SELECT role FROM memberships WHERE store_id=$1 AND account_id=$2 FOR UPDATE",[store,f.id]);
  if(lock.rows[0]?.role!=="investor")return await fail("Investor hisobi mavjud emas");
 }
 s=(await readState(c,store,id,false))!;
 if(rebalance){
  const correction=await correctionFor(c,store,s);
  if(!correction)return await fail("Qaytim ulushlarga mos taqsimlangan. Tuzatish kerak emas.");
  if(correction.reason)return await fail(correction.reason);
  for(const {receipt,shares} of correction.plan){
   for(const x of shares){
    const old=receipt.rows.get(x.id)??zero;
    if(old!==x.share)await c.query("INSERT INTO investor_initial_return_corrections(store_id,order_id,receipt_id,investor_account_id,old_amount_uzs,new_amount_uzs,corrected_by) VALUES($1,$2,$3,$4,$5,$6,$7)",[store,id,receipt.id,x.id,old.toString(),x.share.toString(),member.account_id]);
   }
   await c.query("DELETE FROM investor_initial_returns WHERE store_id=$1 AND receipt_id=$2",[store,receipt.id]);
   // The return keeps its original date, so past months in the investor reports do not move.
   for(const x of shares)if(x.share>zero)await c.query("INSERT INTO investor_initial_returns(store_id,order_id,receipt_id,investor_account_id,amount_uzs,recorded_by,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)",[store,id,receipt.id,x.id,x.share.toString(),member.account_id,receipt.created_at]);
  }
  await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'initial_capital_return_rebalanced','order',$3)",[store,member.account_id,id]);
  await c.query("COMMIT");return reply({ok:true},201);
 }
 const receipt=s.receipts.find(r=>r.id===b.receiptId);
 if(!receipt)return await fail("Amaldagi boshlang‘ich to‘lov topilmadi",404);
 const same=(shares:{id:string;share:bigint}[])=>{
  const wanted=shares.filter(x=>x.share>zero);
  return !entries||(entries.length===wanted.length&&entries.every(e=>wanted.some(x=>x.id===e.accountId&&x.share.toString()===e.amount)));
 };
 if(receipt.rows.size){
  const matches=same([...receipt.rows].map(([k,v])=>({id:k,share:v})));
  await c.query("ROLLBACK");return matches?reply({ok:true,repeated:true}):reply({error:"To‘lov allaqachon taqsimlangan"},409);
 }
 if(!s.installment||!fullyFunded(s))return await fail("To‘liq tan narxi investorlar hisobidan moliyalashtirilgan bo‘lishi kerak");
 const shares=sharesFor(s,receipt);
 if(!same(shares))return await fail("Qaytim ulushlarini tizim hisoblaydi: har bir investorga mahsulotga qo‘shgan puliga mutanosib. Sahifani yangilab, hisoblangan ulushlarni tasdiqlang.",400);
 for(const x of shares){
  if(x.share===zero)continue;
  if(x.share>s.funding.find(f=>f.id===x.id)!.outstanding)return await fail("Qaytim investorning aylanmadagi kapitalidan oshmoqda",400);
  await c.query("INSERT INTO investor_initial_returns(store_id,order_id,receipt_id,investor_account_id,amount_uzs,recorded_by) VALUES($1,$2,$3,$4,$5,$6)",[store,id,receipt.id,x.id,x.share.toString(),member.account_id]);
 }
 await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'initial_capital_return_posted','order',$3)",[store,member.account_id,id]);
 await c.query("COMMIT");return reply({ok:true},201);
 }catch{await c.query("ROLLBACK");return reply({error:"Kapital qaytimi saqlanmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
