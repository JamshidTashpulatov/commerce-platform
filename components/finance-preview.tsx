"use client";
import {useState} from "react";
import {money} from "../lib/catalog";
type Row={id:string;label:string;amount:number;received:number;due:string;status:string};
const installments:Row[]=[
{id:"DEMO-01",label:"Shartnoma A",amount:2400000,received:1200000,due:"2026-12-01",status:"Qisman"},
{id:"DEMO-02",label:"Shartnoma B",amount:1800000,received:1800000,due:"2026-11-20",status:"Yakunlangan"},
{id:"DEMO-03",label:"Shartnoma C",amount:900000,received:0,due:"2026-11-20",status:"Kechikkan"}];
const capital=[{label:"Investor A",contribution:20000000,withdrawal:2000000,distribution:800000},{label:"Investor B",contribution:10000000,withdrawal:0,distribution:400000}];
export function FinancePreview({tab}:{tab:string}){
 const [filter,setFilter]=useState("Barchasi");
 const rows=installments;
 const filtered=rows.filter(r=>filter==="Barchasi"||r.status===filter);
 if(tab==="Investors")return <><div className="metrics"><div className="metric"><span>Kiritilgan kapital</span><strong>{money(capital.reduce((s,r)=>s+r.contribution,0))}</strong></div><div className="metric"><span>Qaytarilgan kapital</span><strong>{money(capital.reduce((s,r)=>s+r.withdrawal,0))}</strong></div><div className="metric"><span>Qayd etilgan taqsimot</span><strong>{money(capital.reduce((s,r)=>s+r.distribution,0))}</strong></div></div><section className="surface"><h3>Investorlar</h3><div className="table-scroll"><table><thead><tr>{["Investor","Kapital","Qaytarilgan","Taqsimot"].map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{capital.map(r=><tr key={r.label}><td>{r.label}</td><td>{money(r.contribution)}</td><td>{money(r.withdrawal)}</td><td>{money(r.distribution)}</td></tr>)}</tbody></table></div></section></>;
 if(tab==="Finance")return <div className="metrics">{[["Nasiya jadvali qoldig‘i",installments.reduce((s,r)=>s+r.amount-r.received,0)],["Jadval bo‘yicha tushum",installments.reduce((s,r)=>s+r.received,0)],["Sof kiritilgan kapital",capital.reduce((s,r)=>s+r.contribution-r.withdrawal,0)]].map(([label,value])=><div className="metric" key={label}><span>{label}</span><strong>{money(Number(value))}</strong></div>)}</div>;
 return <><div className="metrics"><div className="metric"><span>Jami summa</span><strong>{money(filtered.reduce((s,r)=>s+r.amount,0))}</strong></div><div className="metric"><span>Qayd etilgan to‘lov</span><strong>{money(filtered.reduce((s,r)=>s+r.received,0))}</strong></div><div className="metric"><span>Qoldiq</span><strong>{money(filtered.reduce((s,r)=>s+r.amount-r.received,0))}</strong></div></div><section className="surface"><div className="section-head"><h3>To‘lov jadvali</h3><label>Holat<select value={filter} onChange={e=>setFilter(e.target.value)}>{["Barchasi","Qisman","Yakunlangan","Kechikkan"].map(s=><option key={s}>{s}</option>)}</select></label></div><div className="table-scroll"><table><thead><tr>{["ID","Nomi","Muddat","Summa","Qoldiq","Holat"].map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td>{r.id}</td><td>{r.label}</td><td>{r.due}</td><td>{money(r.amount)}</td><td>{money(r.amount-r.received)}</td><td>{r.status}</td></tr>)}</tbody></table></div>{!filtered.length&&<p>Natijalar topilmadi.</p>}</section></>;
}
