"use client";
import {useCallback,useEffect,useState} from "react";
import {staffFetch,formatUzs} from "../lib/staff-client";
type Peer={account_id:string;name:string;principal:string;allocated:string;available:string;distributed:string};
export function PeerPortfolios(){
 const [data,setData]=useState<{enabled:boolean;items:Peer[]}|null>(null);const [error,setError]=useState("");
 const load=useCallback(async()=>{setData(null);setError("");try{setData(await staffFetch<{enabled:boolean;items:Peer[]}>("/api/investor/portfolios"));}catch(e){setError(e instanceof Error?e.message:"Portfoliolar yuklanmadi");}},[]);
 useEffect(()=>{void load();const visible=()=>{if(document.visibilityState==="visible")void load();};document.addEventListener("visibilitychange",visible);return()=>document.removeEventListener("visibilitychange",visible);},[load]);
 if(error)return <section className="surface"><p role="alert">{error}</p><button className="secondary" onClick={()=>void load()}>Qayta yuklash</button></section>;
 if(!data?.enabled)return null;
 return <section className="surface"><div className="section-head"><h2>Boshqa investorlar</h2><button className="secondary" onClick={()=>void load()}>Yangilash</button></div>{data.items.length?<div className="table-scroll"><table><thead><tr>{["Investor","Joriy asosiy kapital","Ajratilgan (yalpi)","Bo‘sh (qaytimlarsiz)","Foyda qaydlari"].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{data.items.map(i=><tr key={i.account_id}><td>{i.name}</td><td>{formatUzs(i.principal)}</td><td>{formatUzs(i.allocated)}</td><td>{formatUzs(i.available)}</td><td>{formatUzs(i.distributed)}</td></tr>)}</tbody></table></div>:<p>Boshqa investorlar yo‘q.</p>}<p className="muted">Faqat ko‘rish uchun. Qaytgan kapital hisobi hali avtomatlashtirilmagan.</p></section>;
}
