"use client";
import {useEffect,useState,useCallback} from "react";
import Link from "next/link";
import {staffFetch,formatDate,formatUzs,requestLabels,saleLabels,deliveryLabels,sourceLabels,type StaffOrder} from "../../lib/staff-client";
export default function StaffInbox(){
 const [orders,setOrders]=useState<StaffOrder[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [query,setQuery]=useState("");
 const [status,setStatus]=useState("");
 const refresh=useCallback(async()=>{setLoading(true);setError("");try{const data=await staffFetch<{items:StaffOrder[]}>("/api/admin/orders");setOrders(data.items);}catch(e){setOrders([]);setError(e instanceof Error?e.message:"Xatolik yuz berdi");}finally{setLoading(false);}},[]);
 useEffect(()=>{void refresh();},[refresh]);
 const filtered=orders.filter(o=>(!status||o.request_status===status)&&o.id.toLowerCase().includes(query.trim().toLowerCase()));
 return <><div className="section-head"><div><p className="eyebrow">SOTUVCHI ISH MAYDONI</p><h1>Buyurtmalar.</h1></div><Link href="/staff/new" className="primary">Buyurtma yaratish</Link></div>
 <p className="muted">Serverdagi oxirgi 100 ta buyurtma.</p>
 <div className="metrics"><div className="metric"><span>Yuklangan buyurtmalar</span><strong>{orders.length}</strong></div><div className="metric"><span>Yangi</span><strong>{orders.filter(o=>o.request_status==="new").length}</strong></div><div className="metric"><span>Sotilgan</span><strong>{orders.filter(o=>o.sale_status==="sold").length}</strong></div></div>
 <section className="surface"><div className="filters"><label>Buyurtma raqami<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Qidirish"/></label><label>Holat<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Barchasi</option>{Object.entries(requestLabels).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label><button className="secondary" disabled={loading} onClick={refresh}>Yangilash</button></div>
 {loading?<p role="status">Yuklanmoqda…</p>:error?<p role="alert">{error}</p>:filtered.length?<div className="table-scroll"><table><thead><tr>{["Raqam","Manba","Sana","So‘rov qiymati","Buyurtma","Sotuv","Yetkazish"].map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{filtered.map(o=><tr key={o.id}><td><Link href={"/staff/orders/"+o.id} className="text-button" aria-label={"Buyurtma "+o.id}>{o.id.slice(0,8)}</Link></td><td>{sourceLabels[o.source]}</td><td>{formatDate(o.created_at)}</td><td>{formatUzs(o.total_uzs??"0")}</td><td>{requestLabels[o.request_status]}</td><td>{saleLabels[o.sale_status]}</td><td>{deliveryLabels[o.fulfillment_status]}</td></tr>)}</tbody></table></div>:<p>Buyurtmalar topilmadi.</p>}</section></>;
}
