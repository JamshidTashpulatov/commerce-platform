"use client";
import {useEffect,useState,useCallback,useRef} from "react";
import {staffFetch,formatUzs} from "../lib/staff-client";
type Data={principal:string|null;allocations:{account_id:string;amount_uzs:string}[];investors:{account_id:string;name:string;available_for_order_uzs:string}[];enabled:boolean};
export function OrderFunding({endpoint,locked}:{endpoint:string;locked:boolean}){
 const url=endpoint+"/funding";const [data,setData]=useState<Data|null>(null);
 const [entries,setEntries]=useState<Record<string,string>>({});const [error,setError]=useState("");const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);const pending=useRef(false);
 const load=useCallback(async()=>{setLoading(true);setError("");try{const d=await staffFetch<Data>(url);setData(d);setEntries(Object.fromEntries(d.allocations.map(a=>[a.account_id,a.amount_uzs])));}catch(e){setData(null);setError(e instanceof Error?e.message:"Yuklab bo‘lmadi");}finally{setLoading(false);}},[url]);
 useEffect(()=>{void load();},[load]);
 const sum=Object.values(entries).reduce((s,v)=>s+BigInt(v||"0"),BigInt(0));
 const principal=BigInt(data?.principal??"0");
 const editable=!!data?.enabled&&!!data.principal&&!locked&&!busy&&!loading;
 const valid=sum<=principal&&Object.entries(entries).every(([id,v])=>{const n=BigInt(v||"0");return n===BigInt(0)||data?.investors.some(i=>i.account_id===id&&n<=BigInt(i.available_for_order_uzs));})&&Object.values(entries).filter(v=>BigInt(v||"0")>BigInt(0)).length<=20;
 async function save(){if(!editable||!valid||pending.current)return;pending.current=true;setBusy(true);setError("");setNotice("");try{await staffFetch(url,"PUT",{allocations:Object.entries(entries).filter(([,v])=>BigInt(v||"0")>BigInt(0)).map(([accountId,v])=>({accountId,amount:BigInt(v).toString()}))});await load();setNotice("Moliyalashtirish saqlandi.");}catch(e){setError(e instanceof Error?e.message:"Saqlash imkoni bo‘lmadi");}finally{pending.current=false;setBusy(false);}}
 return <section className="surface"><div className="section-head"><h2>Moliyalashtirish</h2><button className="secondary" disabled={busy||loading} onClick={load}>Yangilash</button></div>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{loading&&<p>Yuklanmoqda…</p>}
 {data&&!loading&&(!data.principal?<p>Nasiya shartlarini avval saqlang.</p>:<><div className="metrics"><div className="metric"><span>To‘liq tan narxi</span><strong>{formatUzs(principal)}</strong></div><div className="metric"><span>Ajratilgan kapital</span><strong>{formatUzs(sum)}</strong></div><div className="metric"><span>Moliyalashtirish qoldig‘i</span><strong>{formatUzs(principal-sum)}</strong></div></div>
 {!data.enabled&&<p>Modul test sozlamalarida o‘chirilgan.</p>}{locked&&<p>Sotilgan yoki bekor qilingan buyurtmada taqsimot tahrirlanmaydi.</p>}
 {data.investors.length?<div className="form-grid">{data.investors.map(i=><label key={i.account_id}>{i.name}<span className="muted">Mavjud: {formatUzs(i.available_for_order_uzs)}</span><input inputMode="numeric" maxLength={12} disabled={!editable} value={entries[i.account_id]??""} placeholder="0" onChange={e=>setEntries(old=>({...old,[i.account_id]:e.target.value.replace(/[^0-9]/g,"")}))}/></label>)}</div>:<p>Investor hisoblari mavjud emas.</p>}
 {!valid&&<p role="alert">Ajratilgan summalar va mavjud kapitalni tekshiring.</p>}<button className="primary" disabled={!editable||!valid} onClick={()=>void save()}>Taqsimotni saqlash</button><p className="muted">Bu kapitalni hisobga olish. Pul o‘tkazilmaydi. Boshlang‘ich to‘lov ham investor kapitaliga qaytarilishi kerak. Avtomatik qaytarish va foyda taqsimoti hali ulanmagan.</p></>)}</section>;
}
