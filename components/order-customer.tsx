"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {staffFetch} from "../lib/staff-client";
type Customer={id:string;name:string;phone_masked:string;has_passport:boolean};
export function OrderCustomer({endpoint,cancelled,onLinked}:{endpoint:string;cancelled:boolean;onLinked:()=>void}){
 const url=endpoint+"/customer";
 const [linked,setLinked]=useState<Customer|null>(null);
 const [found,setFound]=useState<Customer|null>(null);
 const [phone,setPhone]=useState("");
 const [name,setName]=useState("");
 const [passport,setPassport]=useState("");
 const [stage,setStage]=useState<"find"|"create">("find");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [available,setAvailable]=useState(false);
 const pending=useRef(false);
 const load=useCallback(async()=>{setLoading(true);setError("");try{const d=await staffFetch<{customer:Customer|null}>(url);setLinked(d.customer);setAvailable(true);}catch(e){setAvailable(false);setError(e instanceof Error?e.message:"Mijozni yuklab bo‘lmadi");}finally{setLoading(false);}},[url]);
 useEffect(()=>{void load();},[load]);
 async function run(action:()=>Promise<void>){if(pending.current)return;pending.current=true;setBusy(true);setError("");setNotice("");try{await action();}catch(e){setError(e instanceof Error?e.message:"Amal bajarilmadi");}finally{pending.current=false;setBusy(false);}}
 async function find(){await run(async()=>{const d=await staffFetch<{customer:Customer|null}>("/api/admin/customers","POST",{action:"find",phone});setFound(d.customer);setStage(d.customer?"find":"create");if(!d.customer)setNotice("Mijoz topilmadi. Yangi mijoz yaratishingiz mumkin.");});}
 async function create(){await run(async()=>{const d=await staffFetch<{customer:Customer}>("/api/admin/customers","POST",{action:"create",phone,name,passport});setFound(d.customer);setName("");setPassport("");setPhone("");setStage("find");setNotice("Mijoz yaratildi. Buyurtmaga biriktiring.");});}
 async function attach(){if(!found)return;await run(async()=>{await staffFetch(url,"PUT",{customerId:found.id});setFound(null);setPhone("");setName("");setPassport("");onLinked();});}
 return <section className="surface"><div className="section-head"><h2>Mijoz ma’lumotlari</h2><button className="secondary" disabled={loading||busy} onClick={load}>Yangilash</button></div>
 {loading&&<p role="status">Yuklanmoqda…</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {available&&!loading&&(linked?<div className="form-grid"><div><p className="muted">Mijoz</p><h3>{linked.name}</h3></div><div><p className="muted">Telefon</p><p>{linked.phone_masked}</p></div><div><p className="muted">Pasport ma’lumoti</p><p>{linked.has_passport?"Kiritilgan · himoyalangan":"Kiritilmagan"}</p></div></div>:cancelled?<p>Buyurtma bekor qilingan.</p>:<>
 <p className="muted">Mavjud mijozni telefon orqali toping yoki yangi mijoz yarating. Bu modul faqat vakolatli xodimlar uchun.</p>
 <form className="order-workspace" onSubmit={e=>{e.preventDefault();void find();}}><label>Telefon raqami<input type="tel" autoComplete="off" value={phone} placeholder="+998 XX XXX XX XX" required maxLength={32} disabled={busy} onChange={e=>{setPhone(e.target.value);setFound(null);setStage("find");setName("");setPassport("");}}/></label><button className="secondary" disabled={busy||!phone.trim()} type="submit">Mijozni topish</button></form>
 {found&&<div className="surface"><h3>{found.name}</h3><p>{found.phone_masked}</p><p>{found.has_passport?"Pasport ma’lumoti kiritilgan":"Pasport ma’lumoti kiritilmagan"}</p><button className="primary" disabled={busy} onClick={()=>void attach()}>Buyurtmaga biriktirish</button></div>}
 {stage==="create"&&!found&&<form className="order-workspace" onSubmit={e=>{e.preventDefault();void create();}}><h3>Yangi mijoz</h3><label>Ism va familiya<input value={name} autoComplete="off" maxLength={120} required disabled={busy} onChange={e=>setName(e.target.value)}/></label><label>Pasport yoki ID hujjat raqami (ixtiyoriy)<input value={passport} autoComplete="off" maxLength={20} disabled={busy} onChange={e=>setPassport(e.target.value.toUpperCase())}/></label><p className="muted">Faqat tasdiqlangan zarur ma’lumotlarni kiriting. Pasport raqami saqlangach ochiq ko‘rsatilmaydi.</p><button className="primary" disabled={busy||name.trim().length<2}>Mijoz yaratish</button></form>}
 </>)}</section>;
}
