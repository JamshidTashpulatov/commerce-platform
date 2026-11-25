"use client";
import {useState} from "react";
import Link from "next/link";
import {formatUzs,staffFetch} from "../lib/staff-client";

export type ReceiptReview={id:string;order_id:string;reason:string;amount_uzs:string;resolved_at:string|null;resolution:string|null};
type Props={opening:string;groups:{kind:string;amount_uzs:string}[];reviews:ReceiptReview[];refresh:()=>void};
export function CashbookReconciliation({opening,groups,reviews,refresh}:Props){
 const [expected,setExpected]=useState<Record<string,string>>({});
 const [selected,setSelected]=useState("");
 const [reason,setReason]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const amounts=new Map(groups.map(g=>[g.kind,g.amount_uzs]));
 const checks=[
   ["opening","Davr boshidagi qoldiq",opening],
   ["cash","To‘liq to‘lovlar",amounts.get("cash_sale_receipt")??"0"],
   ["initial","Boshlang‘ich to‘lovlar",amounts.get("initial_receipt")??"0"],
   ["monthly","Oylik tushumlar",amounts.get("monthly_receipt")??"0"],
   ["reversals","Bekor qilingan tushumlar",String(-BigInt(amounts.get("manual_receipt_reversal")??0)-BigInt(amounts.get("monthly_receipt_reversal")??0))]
 ];
 async function resolve(r:ReceiptReview){
   setBusy(true);setError("");
   try{
     await staffFetch("/api/admin/orders/"+r.order_id+"/reviews","POST",{action:"resolve",reviewId:r.id,reason});
     setSelected("");setReason("");refresh();
   }catch(e){setError(e instanceof Error?e.message:"Saqlash imkoni bo‘lmadi");}finally{setBusy(false);}
 }
 return <><section className="surface"><h2>Tarixiy hisob bilan solishtirish</h2>
 <p>Tanlangan davr uchun manba hujjatidagi summalarni kiriting. Farq manba summasidan tizimdagi summani ayirish orqali hisoblanadi.</p>
 {checks.map(([key,label,amount])=><label key={key}>{label} · tizimda {formatUzs(amount)}
 <input inputMode="text" aria-label={label+" — manbadagi summa"} maxLength={32} value={expected[key]??""}
 onChange={e=>{const value=e.target.value;if(/^-?\d*$/.test(value))setExpected(v=>({...v,[key]:value}));}}/>
 {expected[key]&&expected[key]!=="-"&&<span>Farq: {formatUzs(BigInt(expected[key])-BigInt(amount))}</span>}</label>)}
 <p className="muted">Solishtirish ma’lumotlari shu ekranda qoladi. Kassa yozuvlari faqat haqiqiy operatsiya qayd etilganda o‘zgaradi.</p></section>
 <section className="surface"><h2>To‘lov tafovutlari</h2>
 {!reviews.length&&<p>Ochiq yoki shu davrda yopilgan tafovut yo‘q.</p>}
 {reviews.map(r=><article key={r.id}><Link href={"/staff/orders/"+r.order_id}>Buyurtma {r.order_id.slice(0,8)}</Link>
 <p>{formatUzs(r.amount_uzs)} · {r.resolved_at?"Yopilgan":"Ochiq"}</p><p>{r.reason}</p>
 {r.resolution&&<p>{r.resolution}</p>}
 {!r.resolved_at&&(selected===r.id?<form onSubmit={e=>{e.preventDefault();void resolve(r);}}>
 <label>Haqiqiy qaytim yoki tasdiqlangan tuzatish hujjatining sanasi va raqami
 <input required minLength={3} maxLength={240} value={reason} onChange={e=>setReason(e.target.value)}/></label>
 <p>Bu amal tekshiruvni yopadi. Pul harakatini tegishli hisobda alohida qayd eting.</p>
 <button disabled={busy||reason.trim().length<3}>Tafovutni yopish</button></form>:
 <button className="secondary" onClick={()=>{setSelected(r.id);setReason("");}}>Natijani qayd etish</button>)}</article>)}
 {error&&<p role="alert">{error}</p>}</section></>;
}
