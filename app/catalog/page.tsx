"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import type {OptionGroup,OptionSelection} from "../../lib/catalog-options";
import {formatUzs,staffFetch} from "../../lib/staff-client";
type Item={id:string;name:string;category:string;description:string;image_url:string|null;variant_id:string;color:string;storage_label:string|null;price_uzs:string;in_stock:boolean;option_groups:OptionGroup[];option_values:OptionSelection};
export default function PublishedCatalog(){
 const [items,setItems]=useState<Item[]>([]);const [error,setError]=useState("");const [loading,setLoading]=useState(true);const [query,setQuery]=useState("");const [category,setCategory]=useState("");const [chosen,setChosen]=useState<Record<string,string>>({});
 useEffect(()=>{let active=true;staffFetch<{items:Item[]}>("/api/catalog").then(d=>{if(active)setItems(d.items);}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Katalog yuklanmadi");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
 const categories=[...new Set(items.map(i=>i.category))].sort();
 const groups=Array.from(new Set(items.map(i=>i.id))).map(id=>items.filter(i=>i.id===id)).filter(g=>(!category||g[0].category===category)&&g.some(i=>[i.name,i.category,i.color,i.storage_label,...Object.values(i.option_values)].join(" ").toLowerCase().includes(query.toLowerCase().trim())));
 return <><header className="topbar"><Link href="/" className="brand">Do‘kon.</Link><span>Katalog</span></header><main className="container"><section className="hero"><h1>Mahsulotlar.</h1><p>Katalogdagi e’lon qilingan mahsulotlar va mavjud variantlar.</p></section><div className="form-grid"><label>Qidirish<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Mahsulot yoki xususiyat"/></label><label>Kategoriya<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Barchasi</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label></div>
 {loading&&<p role="status">Katalog yuklanmoqda…</p>}{error&&<p role="alert">{error}</p>}{!loading&&!error&&!groups.length&&<p>Mahsulot topilmadi.</p>}
 <div className="products">{groups.map(g=>{const p=g[0];const selected=g.find(v=>v.variant_id===chosen[p.id])??g.find(v=>v.in_stock)??p;return <article className="surface" key={p.id}>{selected.image_url&&<img src={selected.image_url} alt={p.name} referrerPolicy="no-referrer" loading="lazy" style={{width:"100%",height:220,objectFit:"contain"}}/>}<p className="muted">{p.category}</p><h2>{p.name}</h2><p>{p.description}</p>{p.option_groups.length?p.option_groups.map(group=><label key={group.name}>{group.name}<select value={selected.option_values[group.name]??""} onChange={e=>{
 const value=e.target.value;
 const candidates=g.filter(v=>v.option_values[group.name]===value);
 const score=(v:Item)=>Object.entries(selected.option_values).filter(([k,val])=>k!==group.name&&v.option_values[k]===val).length;
 candidates.sort((a,b)=>score(b)-score(a)||Number(b.in_stock)-Number(a.in_stock));
 if(candidates[0])setChosen(o=>({...o,[p.id]:candidates[0].variant_id}));
 }}><option value="" disabled>Tanlang</option>{group.values.map(value=><option key={value.label} value={value.label} disabled={!g.some(v=>v.option_values[group.name]===value.label)}>{value.label}</option>)}</select></label>):<label>Variant<select value={selected.variant_id} onChange={e=>setChosen(o=>({...o,[p.id]:e.target.value}))}>{g.map(v=><option key={v.variant_id} value={v.variant_id}>{[v.color,v.storage_label].filter(Boolean).join(" · ")}</option>)}</select></label>}<h3>{formatUzs(selected.price_uzs)}</h3><p>{selected.in_stock?"Mavjud":"Hozircha mavjud emas"}</p></article>;})}</div><p className="muted">Hozircha server katalogidan mahsulotlarni ko‘rish mumkin. Buyurtma va Telegram autentifikatsiyasi hali ulanmagan.</p></main></>;
}
