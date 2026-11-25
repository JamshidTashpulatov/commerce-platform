"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {products,money} from "../../../../lib/catalog";
import {saveDemoRequest} from "../../../../lib/demo-requests";
export default function NewOrder(){
 const router=useRouter();
 const [id,setId]=useState(products[0].id);
 const p=products.find(p=>p.id===id)??products[0];
 const [color,setColor]=useState(p.colors[0]);
 const [storage,setStorage]=useState(p.specs.Xotira??"—");
 const [qty,setQty]=useState(1);
 const [error,setError]=useState("");
 const options=p.id==="phone"?["256 GB","512 GB","1 TB"]:p.id==="laptop"?["512 GB","1 TB"]:p.id==="tablet"?["256 GB","512 GB","1 TB"]:["—"];
 const unitPrice=p.price+Math.max(0,options.indexOf(storage))*1500000;
 function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();try{const orderId="DEMO-"+crypto.randomUUID().slice(0,8).toUpperCase();saveDemoRequest({id:orderId,product:p.name,storage,color,quantity:qty,total:unitPrice*qty,createdAt:new Date().toISOString()});router.push("/dashboard/orders/"+orderId);}catch{setError("Buyurtmani saqlab bo‘lmadi.");}}
 return <main className="container order-workspace"><Link className="secondary" href="/dashboard">← Buyurtmalarga qaytish</Link><h1>Yangi buyurtma.</h1><p className="muted">Sotuvchi tomonidan mustaqil yaratiladigan namuna buyurtma.</p><form className="surface" onSubmit={submit}><label>Mahsulot<select value={id} onChange={e=>{const next=products.find(x=>x.id===e.target.value)!;setId(next.id);setColor(next.colors[0]);setStorage(next.specs.Xotira??"—");setQty(1);}}>{products.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><div className="form-grid"><label>Xotira<select value={storage} onChange={e=>setStorage(e.target.value)}>{options.map(x=><option key={x}>{x}</option>)}</select></label><label>Rang<select value={color} onChange={e=>setColor(e.target.value)}>{p.colors.map(x=><option key={x}>{x}</option>)}</select></label><label>Miqdor<input type="number" min={1} max={p.stock} value={qty} onChange={e=>setQty(Math.max(1,Math.min(p.stock,Math.trunc(Number(e.target.value)||1))))}/></label></div><h3>Namuna summa: {money(unitPrice*qty)}</h3><button className="primary" type="submit">Buyurtma yaratish</button>{error&&<p role="alert">{error}</p>}</form></main>;
}
