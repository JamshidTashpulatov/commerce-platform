"use client";
import {useEffect,useState,useCallback,useRef} from "react";
import Link from "next/link";
import {OrderCustomer} from "../../../../components/order-customer";
import {OrderInstallments} from "../../../../components/order-installments";
import {OrderCapitalReturns} from "../../../../components/order-capital-returns";
import {OrderFunding} from "../../../../components/order-funding";
import {OrderPayments} from "../../../../components/order-payments";
import {useParams} from "next/navigation";
import {staffFetch,formatDate,formatUzs,requestLabels,saleLabels,deliveryLabels,sourceLabels,type StaffOrder,type StaffItem} from "../../../../lib/staff-client";
type Detail={order:StaffOrder;items:StaffItem[]};
export default function StaffOrderDetails(){
 const {id}=useParams<{id:string}>();
 const [detail,setDetail]=useState<Detail|null>(null);
 const [status,setStatus]=useState("");
 const [delivery,setDelivery]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [confirm,setConfirm]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const pending=useRef(false);
 const endpoint="/api/admin/orders/"+encodeURIComponent(id);
 const refresh=useCallback(async()=>{setLoading(true);setError("");try{const data=await staffFetch<Detail>(endpoint);setDetail(data);setStatus(data.order.request_status);setDelivery(data.order.fulfillment_status);setConfirm(false);}catch(e){setDetail(null);setError(e instanceof Error?e.message:"Buyurtmani yuklab bo‘lmadi");}finally{setLoading(false);}},[endpoint]);
 useEffect(()=>{void refresh();},[refresh]);
 async function mutate(method:string,path:string,body:Record<string,unknown>,success:string){
  if(pending.current||!detail)return;pending.current=true;setBusy(true);setError("");setMessage("");
  try{await staffFetch(path,method,{...body,revision:detail.order.revision});setConfirm(false);setMessage(success);await refresh();}
  catch(e){setError(e instanceof Error?e.message:"Saqlash imkoni bo‘lmadi");}
  finally{pending.current=false;setBusy(false);}
 }
 if(loading)return <p role="status">Buyurtma yuklanmoqda…</p>;
 if(!detail)return <><Link href="/staff">← Buyurtmalar</Link><p role="alert">{error||"Buyurtma topilmadi"}</p><button className="secondary" onClick={refresh}>Qayta yuklash</button></>;
 const o=detail.order;
 const total=detail.items.reduce((sum,item)=>sum+BigInt(item.unit_price_uzs)*BigInt(item.quantity),BigInt(0));
 return <><Link href="/staff" className="text-button">← Buyurtmalar</Link><div className="section-head"><div><p className="eyebrow">BUYURTMA TAFSILOTLARI</p><h1>{o.id.slice(0,8)}</h1><p className="muted">{formatDate(o.created_at)} · {sourceLabels[o.source]}</p></div><button className="secondary" disabled={busy} onClick={refresh}>Yangilash</button></div>
 <div className="metrics"><div className="metric"><span>Buyurtma</span><strong>{requestLabels[o.request_status]}</strong></div><div className="metric"><span>Sotuv</span><strong>{saleLabels[o.sale_status]}</strong></div><div className="metric"><span>Yetkazib berish</span><strong>{deliveryLabels[o.fulfillment_status]}</strong></div></div>
 {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 <section className="surface"><h2>Mahsulotlar</h2><div className="table-scroll"><table><thead><tr>{["Mahsulot","Xotira","Rang","Miqdor","Birlik narxi"].map(s=><th key={s} scope="col">{s}</th>)}</tr></thead><tbody>{detail.items.map(i=><tr key={i.variant_id}><td>{i.name}</td><td>{i.storage_label??"—"}</td><td>{i.color}</td><td>{i.quantity}</td><td>{formatUzs(i.unit_price_uzs)}</td></tr>)}</tbody></table></div><h3>So‘rov qiymati: {formatUzs(total)}</h3></section>
 <section className="surface"><h2>Buyurtma holati</h2><label>Holat<select value={status} disabled={busy||o.sale_status==="sold"} onChange={e=>setStatus(e.target.value)}>{Object.entries(requestLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><button className="secondary" disabled={busy||status===o.request_status||o.sale_status==="sold"} onClick={()=>mutate("PATCH",endpoint,{status},"Buyurtma holati saqlandi.")}>Holatni saqlash</button></section>
 <section className="surface"><h2>Sotuv</h2><p>Ombor qoldig‘i sotuv tasdiqlanganda kamayadi. Bu amal to‘lovni qayd etmaydi.</p>{o.sale_status==="not_sold"&&o.request_status!=="cancelled"?(confirm?<div className="order-workspace"><p><strong>Sotuvni tasdiqlash</strong></p><p>Mahsulotlar ombordan chiqariladi. Qaytarish jarayoni hali mavjud emas.</p><div className="actions"><button className="primary" disabled={busy} onClick={()=>mutate("POST",endpoint+"/sale",{},"Sotuv tasdiqlandi.")}>Ombordan chiqarish va tasdiqlash</button><button className="secondary" disabled={busy} onClick={()=>setConfirm(false)}>Bekor qilish</button></div></div>:<button className="primary" disabled={busy} onClick={()=>setConfirm(true)}>Sotuvni tasdiqlash</button>):<p>{saleLabels[o.sale_status]}</p>}</section>
 <section className="surface"><h2>Yetkazib berish</h2><label>Holat<select value={delivery} disabled={busy||o.sale_status!=="sold"||o.fulfillment_status==="delivered"} onChange={e=>setDelivery(e.target.value)}>{Object.entries(deliveryLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><button className="secondary" disabled={busy||delivery===o.fulfillment_status||o.sale_status!=="sold"||o.fulfillment_status==="delivered"} onClick={()=>mutate("PUT",endpoint,{fulfillment:delivery},"Yetkazib berish holati saqlandi.")}>Yetkazish holatini saqlash</button></section>
 <OrderCustomer endpoint={endpoint} cancelled={o.request_status==="cancelled"} onLinked={()=>void refresh()}/><OrderPayments endpoint={endpoint} cancelled={o.request_status==="cancelled"} onChanged={()=>void refresh()}/><OrderInstallments endpoint={endpoint} cancelled={o.request_status==="cancelled"} onChanged={()=>void refresh()}/><OrderFunding endpoint={endpoint} locked={o.sale_status==="sold"||o.request_status==="cancelled"}/><OrderCapitalReturns endpoint={endpoint} onChanged={()=>void refresh()}/></>;
}
