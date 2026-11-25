"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {readDetails} from "../lib/demo-order-details";
import {readDemoRequests,type DemoRequest} from "../lib/demo-requests";
import {money} from "../lib/catalog";
export function RequestInbox(){
 const [requests,setRequests]=useState<DemoRequest[]>([]);
 useEffect(()=>{setRequests(readDemoRequests());},[]);
 return <section className="surface"><div className="section-head"><h3>Yangi buyurtma so‘rovlari ({requests.length})</h3><div className="actions"><button className="secondary" onClick={()=>setRequests(readDemoRequests())}>Yangilash</button><Link className="primary" href="/dashboard/orders/new">Buyurtma yaratish</Link></div></div><p className="muted">Shu brauzerda yuborilgan namuna so‘rovlar. Sotuv amalga oshirilganini anglatmaydi.</p>{requests.length?<div className="table-scroll"><table><thead><tr>{["Raqam","Mahsulot","Xotira","Rang","Miqdor","So‘rov qiymati","Holat"].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{requests.map(r=><tr key={r.id}><td><Link className="text-button" href={"/dashboard/orders/"+r.id}>{r.id}</Link></td><td>{r.product}</td><td>{r.storage}</td><td>{r.color}</td><td>{r.quantity}</td><td>{money(r.total)}</td><td>{readDetails(r.id,r.total).orderStatus}</td></tr>)}</tbody></table></div>:<p>Hozircha yangi namuna buyurtmalar yo‘q.</p>}</section>;
}
