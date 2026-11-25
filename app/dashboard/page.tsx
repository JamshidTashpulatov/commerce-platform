"use client";
import {useState} from "react";
import Link from "next/link";
import {money,products} from "../../lib/catalog";
const orders=[
{id:"D-001",product:"Phone Pro",amount:12000000,date:"2026-11-24",status:"Yakunlangan",method:"Naqd"},
{id:"D-002",product:"Notebook Air",amount:16500000,date:"2026-11-25",status:"Kutilmoqda",method:"Nasiya"},
{id:"D-003",product:"Tablet Pro",amount:9800000,date:"2026-11-25",status:"Yakunlangan",method:"Naqd"},
{id:"D-004",product:"Headphones",amount:2300000,date:"2026-11-25",status:"Yakunlangan",method:"Naqd"}];
const sections=["Overview","Orders","Sales","Products","Inventory","Installments","Customers","Suppliers","Finance","Investors","Settings"];
export default function Dashboard(){
 const [tab,setTab]=useState("Overview");
 const [status,setStatus]=useState("Barchasi");
 const [method,setMethod]=useState("Barchasi");
 const [date,setDate]=useState("");
 const [q,setQ]=useState("");
 const filtered=orders.filter(o=>(status==="Barchasi"||o.status===status)&&(method==="Barchasi"||o.method===method)&&(!date||o.date===date)&&(o.id+" "+o.product).toLowerCase().includes(q.toLowerCase()));
 const settled=filtered.filter(o=>o.status==="Yakunlangan");
 return <div className="dashboard"><aside className="sidebar"><Link href="/" className="brand">Store.</Link>{sections.map(t=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t}</button>)}</aside><main className="dash-content"><div><p className="eyebrow">DEMO / PUBLIC PREVIEW</p><h1>{tab}</h1><p className="muted">Faqat namuna ma’lumotlari. Real hisoblar yoki mijoz ma’lumotlari mavjud emas.</p></div>
 {["Overview","Orders","Sales"].includes(tab)?<><div className="filters"><label>Sana<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Holat<select value={status} onChange={e=>setStatus(e.target.value)}>{["Barchasi","Yakunlangan","Kutilmoqda"].map(s=><option key={s}>{s}</option>)}</select></label><label>To‘lov turi<select value={method} onChange={e=>setMethod(e.target.value)}>{["Barchasi","Naqd","Nasiya"].map(s=><option key={s}>{s}</option>)}</select></label><label>Qidirish<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buyurtma yoki mahsulot"/></label></div>
 <div className="metrics"><div className="metric"><span>Buyurtmalar</span><strong>{filtered.length}</strong></div><div className="metric"><span>Jami buyurtma qiymati</span><strong>{money(filtered.reduce((s,o)=>s+o.amount,0))}</strong></div><div className="metric"><span>Yakunlangan sotuvlar</span><strong>{money(settled.reduce((s,o)=>s+o.amount,0))}</strong></div><div className="metric"><span>Kutilmoqda</span><strong>{filtered.length-settled.length}</strong></div></div>
 {tab==="Overview"&&<section className="surface"><h3>Sotuvlar bo‘yicha taqsimot</h3><div className="bars">{["Naqd","Nasiya"].map(m=>{const v=filtered.filter(o=>o.method===m).length;return <div className="bar-row" key={m}><span>{m}: {v}</span><div className="bar-track"><div className="bar-fill" style={{width:(filtered.length?v/filtered.length*100:0)+"%"}}/></div></div>})}</div></section>}
 <section className="surface"><h3>Buyurtmalar</h3><div className="table-scroll"><table><thead><tr>{["ID","Mahsulot","Sana","Summa","To‘lov","Holat"].map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{filtered.map(o=><tr key={o.id}><td>{o.id}</td><td>{o.product}</td><td>{o.date}</td><td>{money(o.amount)}</td><td>{o.method}</td><td>{o.status}</td></tr>)}</tbody></table></div>{!filtered.length&&<p>Buyurtmalar topilmadi.</p>}</section></>:["Products","Inventory"].includes(tab)?<section className="surface"><h3>Mahsulotlar va qoldiq</h3><div className="table-scroll"><table><thead><tr>{["Mahsulot","Kategoriya","Narx","Qoldiq"].map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{products.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.category}</td><td>{money(p.price)}</td><td>{p.stock} ta</td></tr>)}</tbody></table></div></section>:<section className="surface"><h3>{tab} — tayyorlanmoqda</h3><p>Bu modul uchun server, rollar va biznes qoidalari tasdiqlanishi kerak. Demo rejimida real operatsiyalar mavjud emas.</p></section>}
 </main></div>
}
