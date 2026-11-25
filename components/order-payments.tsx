"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {staffFetch,formatUzs} from "../lib/staff-client";
type Terms={agreed_total_uzs:string;payment_type:"cash"|"installment";initial_due_uzs:string};
type Receipt={id:string;amount_uzs:string;kind:"cash"|"initial";method:string;received_on:string;reversed:boolean};
type PaymentData={terms:Terms|null;receipts:Receipt[];received_uzs:string;remaining_uzs:string|null;manual_received_uzs:string;has_schedule:boolean};
const methods:Record<string,string>={cash:"Naqd",transfer:"Pul o‘tkazmasi",other:"Boshqa"};
function today(){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tashkent",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());return ["year","month","day"].map(k=>parts.find(p=>p.type===k)?.value).join("-");}
export function OrderPayments({endpoint,cancelled,onChanged}:{endpoint:string;cancelled:boolean;onChanged?:()=>void}){
 const url=endpoint+"/payments";
 const [data,setData]=useState<PaymentData|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [total,setTotal]=useState("");
 const [type,setType]=useState<"cash"|"installment">("cash");
 const [initial,setInitial]=useState("0");
 const [amount,setAmount]=useState("");
 const [method,setMethod]=useState("cash");
 const [date,setDate]=useState("");
 const [reverseId,setReverseId]=useState("");
 const [reason,setReason]=useState("");
 const key=useRef("");const pending=useRef(false);
 const load=useCallback(async()=>{setLoading(true);setError("");try{const d=await staffFetch<PaymentData>(url);setData(d);setTotal(d.terms?.agreed_total_uzs??"");setType(d.terms?.payment_type??"cash");setInitial(d.terms?.initial_due_uzs??"0");}catch(e){setData(null);setError(e instanceof Error?e.message:"To‘lovlar yuklanmadi");}finally{setLoading(false);}},[url]);
 useEffect(()=>{setDate(today());void load();},[load]);
 async function post(body:Record<string,unknown>,success:string){if(pending.current)return;pending.current=true;setBusy(true);setError("");setNotice("");try{await staffFetch(url,"POST",body);setNotice(success);if(body.action==="receipt"){setAmount("");key.current="";}setReverseId("");setReason("");await load();onChanged?.();}catch(e){setError(e instanceof Error?e.message:"Saqlash imkoni bo‘lmadi");}finally{pending.current=false;setBusy(false);}}
 const valid=(s:string)=>/^(0|[1-9][0-9]{0,11})$/.test(s);
 const locked=!!data?.receipts.length||!!data?.has_schedule||cancelled;
 const editable=!locked&&!busy;
 const canSave=editable&&valid(total)&&BigInt(total)>BigInt(0)&&(type==="cash"||(valid(initial)&&BigInt(initial)>BigInt(0)&&BigInt(initial)<=BigInt(total)));
 const cap=data?.terms?(BigInt(data.terms.payment_type==="cash"?data.terms.agreed_total_uzs:data.terms.initial_due_uzs)-BigInt(data.manual_received_uzs)):BigInt(0);
 const canReceipt=!busy&&!cancelled&&!data?.has_schedule&&!!data?.terms&&valid(amount)&&BigInt(amount)>BigInt(0)&&BigInt(amount)<=cap&&!!date;
 return <section className="surface"><div className="section-head"><h2>To‘lovlar</h2><button className="secondary" disabled={loading||busy} onClick={load}>Yangilash</button></div><p className="muted">Tizimdan tashqarida olingan to‘lovlarni qo‘lda qayd eting. Bu pul o‘tkazmasi emas.</p>{loading?<p role="status">Yuklanmoqda…</p>:null}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {data&&!loading&&<><form onSubmit={e=>{e.preventDefault();if(canSave)void post({action:"terms",total,type,initial:type==="cash"?"0":initial},"To‘lov shartlari saqlandi.");}} className="order-workspace"><h3>Kelishilgan shartlar</h3><div className="form-grid"><label>Kelishilgan jami summa, UZS<input inputMode="numeric" value={total} maxLength={12} disabled={!editable} onChange={e=>setTotal(e.target.value.replace(/[^0-9]/g,""))}/></label><label>To‘lov turi<select value={type} disabled={!editable} onChange={e=>setType(e.target.value as "cash"|"installment")}><option value="cash">To‘liq to‘lov</option><option value="installment">Nasiya</option></select></label>{type==="installment"&&<label>Kelishilgan boshlang‘ich to‘lov, UZS<input inputMode="numeric" value={initial} maxLength={12} disabled={!editable} onChange={e=>setInitial(e.target.value.replace(/[^0-9]/g,""))}/></label>}</div>{locked?<p className="muted">To‘lov qayd etilgach yoki buyurtma bekor qilinsa, shartlar bloklanadi.</p>:<button type="submit" className="secondary" disabled={!canSave}>Shartlarni saqlash</button>}</form>
 {data.terms&&<><div className="metrics"><div className="metric"><span>Qayd etilgan tushum</span><strong>{formatUzs(data.received_uzs)}</strong></div><div className="metric"><span>Umumiy qoldiq</span><strong>{formatUzs(data.remaining_uzs??"0")}</strong></div>{data.terms.payment_type==="installment"&&<div className="metric"><span>Boshlang‘ich to‘lov qoldig‘i</span><strong>{formatUzs(cap)}</strong></div>}</div>
 {data.terms.payment_type==="installment"&&<p className="muted">Oylik to‘lovlarni quyidagi nasiya jadvali bo‘limida qayd eting.</p>}
 {!data.has_schedule&&<form className="order-workspace" onSubmit={e=>{e.preventDefault();if(!canReceipt)return;key.current ||= crypto.randomUUID();void post({action:"receipt",amount,method,date,key:key.current},"To‘lov qayd etildi.");}}><h3>To‘lov qo‘shish</h3><div className="form-grid"><label>Olingan summa, UZS<input inputMode="numeric" value={amount} maxLength={12} disabled={busy||cancelled||cap<=BigInt(0)} onChange={e=>{setAmount(e.target.value.replace(/[^0-9]/g,""));key.current="";}}/></label><label>To‘lov sanasi<input type="date" value={date} disabled={busy||cancelled} onChange={e=>{setDate(e.target.value);key.current="";}}/></label><label>To‘lov usuli<select value={method} disabled={busy||cancelled} onChange={e=>{setMethod(e.target.value);key.current="";}}>{Object.entries(methods).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div><button type="submit" className="primary" disabled={!canReceipt}>To‘lovni qayd etish</button></form>}</>}
 <h3>To‘lovlar tarixi</h3>{data.receipts.length?<div className="table-scroll"><table><thead><tr>{["Sana","Summa","Turi","Usul","Holat","Amal"].map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{data.receipts.map(r=><tr key={r.id}><td>{r.received_on}</td><td>{formatUzs(r.amount_uzs)}</td><td>{r.kind==="initial"?"Boshlang‘ich":"To‘liq to‘lov"}</td><td>{methods[r.method]}</td><td>{r.reversed?"Bekor qilingan":"Qayd etilgan"}</td><td>{!r.reversed&&!cancelled&&!data.has_schedule&&<button className="text-button" disabled={busy} onClick={()=>{setReverseId(r.id);setReason("");}}>Qaydni bekor qilish</button>}</td></tr>)}</tbody></table></div>:<p>Hozircha to‘lov qayd etilmagan.</p>}
 {reverseId&&<form className="order-workspace" onSubmit={e=>{e.preventDefault();void post({action:"reverse",receiptId:reverseId,reason},"To‘lov qaydi bekor qilindi.");}}><p>Faqat egasi yoki administrator xato qaydni bekor qilishi mumkin. Bu pulni qaytarish amali emas.</p><label>Sabab<input value={reason} maxLength={240} onChange={e=>setReason(e.target.value)} disabled={busy}/></label><div className="actions"><button className="primary" type="submit" disabled={busy||reason.trim().length<3}>Qaydni bekor qilish</button><button className="secondary" type="button" disabled={busy} onClick={()=>setReverseId("")}>Ortga</button></div></form>}</>}
 </section>;
}
