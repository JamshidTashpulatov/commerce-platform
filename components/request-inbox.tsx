"use client";
import {useEffect,useState} from "react";
import {readDemoRequests,type DemoRequest} from "../lib/demo-requests";
import {money} from "../lib/catalog";
export function RequestInbox(){
 const [requests,setRequests]=useState<DemoRequest[]>([]);
 useEffect(()=>{setRequests(readDemoRequests());},[]);
 return <section className="surface"><div className="section-head"><h3>Yangi buyurtma so‘rovlari ({requests.length})</h3><button className="secondary" onClick={()=>setRequests(readDemoRequests())}>Yangilash</button></div><p className="muted">Shu brauzerda yuborilgan demo so‘rovlar. Sotuv amalga oshirilganini anglatmaydi.</p>{requests.length?<div className="table-scroll"><table><thead><tr>{["ID","Mahsulot","Xotira","Rang","Miqdor","So‘rov qiymati","Holat"].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{requests.map(r=><tr key={r.id}><td>{r.id}</td><td>{r.product}</td><td>{r.storage}</td><td>{r.color}</td><td>{r.quantity}</td><td>{money(r.total)}</td><td>Yangi</td></tr>)}</tbody></table></div>:<p>Hozircha yangi demo buyurtmalar yo‘q.</p>}</section>;
}
