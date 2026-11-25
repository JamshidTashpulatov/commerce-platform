"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useParams} from "next/navigation";
import {readDemoRequests,type DemoRequest} from "../../../../lib/demo-requests";
import {readDetails,saveDetails,defaultDetails,type OrderDetails} from "../../../../lib/demo-order-details";
import {money} from "../../../../lib/catalog";
export default function OrderPage(){
 const {id}=useParams<{id:string}>();
 const [request,setRequest]=useState<DemoRequest|null>(null);
 const [loaded,setLoaded]=useState(false);
 const [d,setD]=useState<OrderDetails>(defaultDetails(0));
 const [message,setMessage]=useState("");
 useEffect(()=>{const r=readDemoRequests().find(r=>r.id===id);setRequest(r??null);if(r)setD(readDetails(id,r.total));setLoaded(true);},[id]);
 function change<K extends keyof OrderDetails>(key:K,value:OrderDetails[K]){setD(p=>({...p,[key]:value}));setMessage("");}
 const numbers=(key:"salePrice"|"cost"|"initial"|"received"|"months"|"rate"|"fundingA"|"fundingB",label:string,max=100000000000)=> <label>{label}<input type="number" min={0} max={max} step={1} value={d[key]} onChange={e=>change(key,Math.min(max,Math.max(0,Math.trunc(Number(e.target.value)||0))))}/></label>;
 function save(){
 if(d.initial+d.received>d.salePrice){setMessage("Qayd etilgan to‘lov kelishilgan jami summadan oshmasligi kerak.");return;}
 if(d.orderStatus==="Bekor qilingan"&&d.saleStatus==="Sotilgan"){setMessage("Bekor qilingan buyurtmani sotilgan deb belgilash mumkin emas.");return;}
 if(d.deliveryStatus==="Yetkazilgan"&&d.saleStatus!=="Sotilgan"){setMessage("Avval sotuv holatini tasdiqlang.");return;}

 try{saveDetails(id,d);setMessage("Namuna buyurtma saqlandi.");}catch{setMessage("Saqlash imkoni bo‘lmadi.");}}
 if(!loaded)return <main className="container"><p>Yuklanmoqda…</p></main>;
 if(!request)return <main className="container"><h2>Buyurtma topilmadi.</h2><Link className="secondary" href="/dashboard">Boshqaruv paneliga qaytish</Link></main>;
 const remaining=Math.max(0,d.salePrice-d.initial-d.received);
 return <main className="container order-workspace"><Link href="/dashboard" className="secondary">← Buyurtmalarga qaytish</Link><p className="eyebrow">NAMUNA / BUYURTMA TAFSILOTLARI</p><h1>{request.id}</h1><p>{request.product} · {request.storage} · {request.color} · {request.quantity} dona</p><p className="muted">Faqat shartli raqamlar. Haqiqiy mijoz yoki moliya ma’lumotlarini kiritmang.</p>
 <section className="surface"><h2>Buyurtma holati</h2><div className="form-grid"><label>Buyurtma<select value={d.orderStatus} onChange={e=>change("orderStatus",e.target.value as OrderDetails["orderStatus"])}>{["Yangi","Jarayonda","Bekor qilingan"].map(s=><option key={s}>{s}</option>)}</select></label><label>Sotuv<select value={d.saleStatus} onChange={e=>change("saleStatus",e.target.value as OrderDetails["saleStatus"])}>{["Sotilmagan","Sotilgan"].map(s=><option key={s}>{s}</option>)}</select></label><label>Yetkazib berish<select value={d.deliveryStatus} onChange={e=>change("deliveryStatus",e.target.value as OrderDetails["deliveryStatus"])}>{["Yetkazilmagan","Yo‘lda","Yetkazilgan"].map(s=><option key={s}>{s}</option>)}</select></label></div></section>
 <section className="surface"><h2>Mijoz ma’lumotlari</h2><p className="muted">Bu ochiq namuna. Himoyalangan mijoz formasida sotuvchi haqiqiy ma’lumotlarni qo‘lda kiritadi.</p><div className="form-grid"><label>F.I.Sh.<input value="Namuna mijoz" readOnly/></label><label>Telefon<input value="+998 XX XXX XX XX" readOnly/></label><label>Pasport<input value="•• •••••••" readOnly/></label><label>Manzil<input value="Namuna manzil" readOnly/></label></div><label className="check-label"><input type="checkbox" checked={d.customerSaved} onChange={e=>change("customerSaved",e.target.checked)}/>Namuna mijoz ma’lumotlari tekshirildi</label></section>
 <section className="surface"><h2>Sotuv va to‘lov</h2><div className="form-grid">{numbers("cost","Tan narxi, $")}{numbers("salePrice","Kelishilgan jami summa, $")}<label>To‘lov turi<select value={d.method} onChange={e=>change("method",e.target.value as OrderDetails["method"])}>{["Belgilanmagan","Naqd","Nasiya"].map(s=><option key={s}>{s}</option>)}</select></label>{numbers("initial","Boshlang‘ich to‘lov, $")}{numbers("received","Keyingi qayd etilgan to‘lovlar, $")}{d.method==="Nasiya"&&<>{numbers("months","Muddat, oy",60)}{numbers("rate","Kelishilgan oylik foiz, %",100)}</>}</div><div className="metrics"><div className="metric"><span>Qayd etilgan to‘lov</span><strong>{money(d.initial+d.received)}</strong></div><div className="metric"><span>Qoldiq</span><strong>{money(remaining)}</strong></div></div><p className="muted">Jami summa sotuvchi tomonidan kelishiladi. Ustama va to‘lov jadvali formulasi hali tasdiqlanmagan; bu demo hisob-kitob shartnoma emas.</p></section>
 <section className="surface"><h2>Moliyalashtirish manbalari</h2><div className="form-grid">{numbers("fundingA","Investor A, $")}{numbers("fundingB","Investor B, $")}</div><p>Ajratilgan mablag‘: {money(d.fundingA+d.fundingB)}</p><p className="muted">Investor A va B shartli hisoblar. Mablag‘ taqsimoti real hisobga yozilmaydi.</p></section>
 <div className="surface"><button className="primary" onClick={save}>O‘zgarishlarni saqlash</button>{message&&<p role="status">{message}</p>}</div></main>;
}
