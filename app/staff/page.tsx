"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {staffFetch,formatDate,formatUzs,requestLabels,saleLabels,deliveryLabels,sourceLabels,type StaffOrder} from "../../lib/staff-client";
export default function StaffInbox(){
 const [orders,setOrders]=useState<StaffOrder[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [query,setQuery]=useState("");
 const [status,setStatus]=useState("");
 const [pages,setPages]=useState<string[]>([]);
 const [next,setNext]=useState<string|null>(null);
 const [revision,setRevision]=useState(0);
 const cursor=pages[pages.length-1];
 useEffect(()=>{
   let active=true;
   setLoading(true);
   setError("");
   setNext(null);
   const params=new URLSearchParams({q:query.trim(),status});
   if(cursor)params.set("after",cursor);
   const timer=setTimeout(async()=>{
     try {
       const data=await staffFetch<{items:StaffOrder[];next:string|null}>("/api/admin/orders?"+params);
       if(active){setOrders(data.items);setNext(data.next);}
     } catch(e) {
       if(active){setOrders([]);setError(e instanceof Error?e.message:"Buyurtmalarni yuklab bo‘lmadi");}
     } finally {if(active)setLoading(false);}
   },query?200:0);
   return ()=>{active=false;clearTimeout(timer);};
 },[query,status,cursor,revision]);
 return <><div className="section-head"><div><p className="eyebrow">SOTUVCHI ISH MAYDONI</p><h1>Buyurtmalar.</h1></div><Link href="/staff/new" className="primary">Buyurtma yaratish</Link></div>
 <p className="muted">Bir sahifada 100 tagacha buyurtma ko‘rsatiladi.</p>
 <div className="metrics"><div className="metric"><span>Sahifadagi buyurtmalar</span><strong>{orders.length}</strong></div><div className="metric"><span>Sahifada yangi</span><strong>{orders.filter(o=>o.request_status==="new").length}</strong></div><div className="metric"><span>Sahifada sotilgan</span><strong>{orders.filter(o=>o.sale_status==="sold").length}</strong></div></div>
 <section className="surface"><div className="filters"><label>Buyurtma raqami<input type="search" value={query} maxLength={36} onChange={e=>{setPages([]);setQuery(e.target.value);}} placeholder="Qidirish"/></label><label>Holat<select value={status} onChange={e=>{setPages([]);setStatus(e.target.value);}}><option value="">Barchasi</option>{Object.entries(requestLabels).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label><button className="secondary" disabled={loading} onClick={()=>setRevision(r=>r+1)}>Yangilash</button></div>
 {loading?<p role="status">Yuklanmoqda…</p>:error?<p role="alert">{error}</p>:orders.length?<div className="table-scroll"><table><thead><tr>{["Raqam","Manba","Sana","So‘rov qiymati","Buyurtma","Sotuv","Yetkazish"].map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{orders.map(o=><tr key={o.id}><td><Link href={"/staff/orders/"+o.id} className="text-button" aria-label={"Buyurtma "+o.id}>{o.id.slice(0,8)}</Link></td><td>{sourceLabels[o.source]}</td><td>{formatDate(o.created_at)}</td><td>{formatUzs(o.total_uzs??"0")}</td><td>{requestLabels[o.request_status]}</td><td>{saleLabels[o.sale_status]}</td><td>{deliveryLabels[o.fulfillment_status]}</td></tr>)}</tbody></table></div>:<p>Buyurtmalar topilmadi.</p>}<nav aria-label="Buyurtma sahifalari">
 {pages.length>0&&<button className="secondary" disabled={loading} onClick={()=>setPages(p=>p.slice(0,-1))}>Oldingi sahifa</button>}
 {next&&<button className="secondary" disabled={loading} onClick={()=>setPages(p=>[...p,next])}>Keyingi sahifa</button>}
 </nav></section></>;
}
