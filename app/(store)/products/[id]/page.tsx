"use client";
import {useState} from "react";
import {useParams} from "next/navigation";
import Link from "next/link";
import {products,money} from "../../../lib/catalog";
import {ProductArt} from "../../../components/product-art";
import {saveDemoRequest} from "../../../lib/demo-requests";
export default function ProductDetails(){
 const {id}=useParams<{id:string}>();
 const p=products.find(p=>p.id===id);
 const options=id==="phone"?["256 GB","512 GB","1 TB"]:id==="laptop"?["512 GB","1 TB"]:id==="tablet"?["256 GB","512 GB","1 TB"]:["—"];
 const [storage,setStorage]=useState(options[0]);
 const [color,setColor]=useState(p?.colors[0]??"");
 const [qty,setQty]=useState(1);
 const [step,setStep]=useState<"configure"|"contact"|"authenticate"|"sent">("configure");
 const [requestId,setRequestId]=useState("");
 const [error,setError]=useState("");
 if(!p)return <main className="container"><h1>Mahsulot topilmadi.</h1><Link href="/">Katalogga qaytish</Link></main>;
 const price=p.price+options.indexOf(storage)*1500000;
 function submit(){
   try{const key="DEMO-"+crypto.randomUUID().slice(0,8).toUpperCase();saveDemoRequest({id:key,product:p!.name,storage,color,quantity:qty,total:price*qty,createdAt:new Date().toISOString()});setRequestId(key);setStep("sent");}catch{setError("Namuna buyurtmani saqlab bo‘lmadi. Qayta urinib ko‘ring.");}
 }
 return <><header className="topbar"><Link className="brand" href="/">Do‘kon.</Link><Link href="/#catalog">Katalog</Link></header><main className="container"><p className="eyebrow">MAHSULOT TAFSILOTLARI / NAMUNA</p><section className="details-grid"><div className="surface"><ProductArt symbol={p.symbol}/><h1>{p.name}</h1><p className="muted">{p.category}</p><p>{money(price)}</p></div><div className="surface">
 {step==="configure"?<><h2>O‘zingizga mosini tanlang.</h2>{options[0]!=="—"&&<fieldset><legend>Xotira</legend><div className="chips">{options.map(s=><button className={s===storage?"chip active":"chip"} aria-pressed={s===storage} key={s} onClick={()=>setStorage(s)}>{s}</button>)}</div></fieldset>}<fieldset><legend>Rang</legend><div className="chips">{p.colors.map(c=><button key={c} className={c===color?"chip active":"chip"} aria-pressed={c===color} onClick={()=>setColor(c)}>{c}</button>)}</div></fieldset><label>Miqdor<input type="number" min={1} max={p.stock} value={qty} onChange={e=>setQty(Math.max(1,Math.min(p.stock,Math.floor(Number(e.target.value)||1))))}/></label><h3>{money(price*qty)}</h3><button className="primary" onClick={()=>setStep("contact")}>Sotib olish</button><p className="muted">Buyurtma yuboriladi. To‘lovni sotuvchi bilan kelishasiz.</p></>:step==="contact"?<><h2>Telefon raqamingiz</h2><p>Sotuvchi siz bilan buyurtma bo‘yicha bog‘lanadi.</p><label>Namuna telefon raqami<input value="+998 XX XXX XX XX" readOnly/></label><p className="muted">Bu namuna. Haqiqiy raqam kiritilmaydi.</p><button className="primary" onClick={()=>setStep("authenticate")}>Davom etish</button><button className="secondary" onClick={()=>setStep("configure")}>Ortga</button></>:step==="authenticate"?<><h2>Telegram orqali kirish</h2><p className="muted">Telegram avtorizatsiyasi namuna sifatida ko‘rsatiladi. Hech qanday hisobga ulanmaydi.</p><button className="primary" onClick={submit}>Namuna buyurtma yuborish</button><button className="secondary" onClick={()=>setStep("contact")}>Ortga</button>{error&&<p role="alert">{error}</p>}</>:<><p className="eyebrow">BUYURTMA QABUL QILINDI / NAMUNA</p><h2>Buyurtma yuborildi.</h2><p>Namuna raqami: {requestId}</p><p>Haqiqiy tizimda sotuvchi siz bilan bog‘lanadi.</p><Link href="/dashboard" className="secondary">Boshqaruv panelida ko‘rish</Link><Link href="/" className="primary">Katalogga qaytish</Link></>}
 </div></section><footer>Mahsulot, narx va mavjudlik namuna. Real sotuv yoki avtorizatsiya bajarilmaydi.</footer></main></>;
}
