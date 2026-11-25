"use client";
import {useEffect,useRef,useState} from "react";
export function CatalogImageUpload({label,value,onChange,disabled,onBusy}:{label:string;value:string;onChange:(url:string)=>void;disabled:boolean;onBusy:(busy:boolean)=>void}){
 const [loading,setLoading]=useState(false);const [error,setError]=useState("");const input=useRef<HTMLInputElement>(null);const pending=useRef(false);const alive=useRef(true);const controller=useRef<AbortController|null>(null);
 const callback=useRef(onChange);callback.current=onChange;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort();};},[]);
 async function upload(file:File){
 if(disabled||pending.current)return;
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setError("JPG, PNG yoki WebP formatini tanlang.");return;}
 if(!file.size||file.size>3*1024*1024){setError("Fayl hajmi 3 MB dan oshmasligi kerak.");return;}
 pending.current=true;setLoading(true);setError("");onBusy(true);const abort=new AbortController();controller.current=abort;
 try{
 const r=await fetch("/api/admin/catalog/media",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":file.type},body:file,signal:abort.signal});
 const d=await r.json();
 if(!r.ok||typeof d.url!=="string"||!d.url.startsWith("/api/catalog/media/"))throw new Error(d.error||"Rasm yuklanmadi");
 if(alive.current)callback.current(d.url);
 }catch(e){if(alive.current)setError(e instanceof Error?e.message:"Rasm yuklanmadi");}
 finally{pending.current=false;controller.current=null;onBusy(false);if(alive.current){setLoading(false);if(input.current)input.current.value="";}}
 }
 return <div className="order-workspace"><label>{label}</label>{value&&<div className="surface">{value.startsWith("/api/catalog/media/")?<img src={value} alt={label} style={{width:"100%",maxHeight:160,objectFit:"contain"}}/>:<p className="muted">Mavjud tashqi rasm manzili biriktirilgan.</p>}<button type="button" className="text-button" disabled={disabled||loading} onClick={()=>onChange("")}>Rasmni olib tashlash</button></div>}
 <label>Fayl tanlash<input ref={input} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled||loading} onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);}}/></label><p className="muted">JPG, PNG, WebP · 3 MB gacha</p>{loading&&<p role="status">Rasm yuklanmoqda…</p>}{error&&<p role="alert">{error}</p>}</div>;
}
