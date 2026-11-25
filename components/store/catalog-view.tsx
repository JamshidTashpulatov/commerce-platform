"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import {usePathname,useRouter,useSearchParams} from "next/navigation";
import type {OptionGroup,OptionSelection} from "../../lib/catalog-options";
import {fromSoum,isColorGroup,productHref,sortCategories,swatchColor} from "../../lib/storefront";
import {ProductVisual} from "./product-visual";
import {SearchIcon} from "./store-nav";

type Row={id:string;name:string;category:string;description:string;image_url:string|null;variant_id:string;color:string;
  storage_label:string|null;price_uzs:string;in_stock:boolean;option_groups:OptionGroup[];option_values:OptionSelection};
type Card={id:string;name:string;category:string;image:string|null;fromPrice:string;inStock:boolean;variants:number;
  swatches:{label:string;image:string|null}[]};

function toCards(rows:Row[]):Card[]{
  const byProduct=new Map<string,Row[]>();
  for(const r of rows)byProduct.set(r.id,[...(byProduct.get(r.id)??[]),r]);
  return [...byProduct.values()].map(list=>{
    const head=list[0];
    const cheapest=list.reduce((m,r)=>BigInt(r.price_uzs)<BigInt(m.price_uzs)?r:m,head);
    const colorGroup=head.option_groups.find(g=>isColorGroup(g.name));
    const swatches=colorGroup?colorGroup.values.filter(v=>list.some(r=>r.option_values[colorGroup.name]===v.label))
      .map(v=>({label:v.label,image:v.imageUrl})):[];
    const cover=list.find(r=>r.in_stock&&r.image_url)??list.find(r=>r.image_url)??head;
    return {id:head.id,name:head.name,category:head.category,image:cover.image_url,fromPrice:cheapest.price_uzs,
      inStock:list.some(r=>r.in_stock),variants:list.length,swatches};
  });
}

export function CatalogView(){
  const router=useRouter();
  const pathname=usePathname();
  const params=useSearchParams();
  const category=params.get("category")??"";
  const [query,setQuery]=useState(()=>params.get("q")??"");
  const [rows,setRows]=useState<Row[]>([]);
  const [categories,setCategories]=useState<string[]>([]);
  const [next,setNext]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  const filterKey=category+"\u0000"+query.trim();
  // The cursor stack belongs to one filter; changing the filter starts again at page one.
  const [paging,setPaging]=useState<{key:string;pages:string[]}>({key:filterKey,pages:[]});
  const pages=paging.key===filterKey?paging.pages:[];
  const cursor=pages[pages.length-1];
  const top=useRef<HTMLDivElement>(null);
  const search=useRef<HTMLInputElement>(null);

  useEffect(()=>{if(window.location.hash==="#qidiruv")search.current?.focus();},[]);

  useEffect(()=>{
    let active=true;
    setLoading(true);setError("");
    const q=query.trim();
    const timer=setTimeout(async()=>{
      const url=new URLSearchParams();
      if(category)url.set("category",category);
      if(q)url.set("q",q);
      const shown=url.toString();
      if(shown!==params.toString())router.replace(pathname+(shown?"?"+shown:""),{scroll:false});
      const api=new URLSearchParams({q,category});
      if(cursor)api.set("after",cursor);
      try{
        const res=await fetch("/api/catalog?"+api,{cache:"no-store"});
        const data=await res.json().catch(()=>null);
        if(!res.ok)throw new Error(typeof data?.error==="string"?data.error:"Katalog yuklanmadi");
        if(active){setRows(data.items);setCategories(data.categories);setNext(data.next);}
      }catch(e){
        if(active){setRows([]);setNext(null);setError(e instanceof Error?e.message:"Katalog yuklanmadi");}
      }finally{if(active)setLoading(false);}
    },q?250:0);
    return ()=>{active=false;clearTimeout(timer);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[category,query,cursor,retry]);

  const cards=useMemo(()=>toCards(rows),[rows]);
  const setCategory=(c:string)=>{
    const url=new URLSearchParams();
    if(c)url.set("category",c);
    if(query.trim())url.set("q",query.trim());
    router.replace(pathname+(url.size?"?"+url:""),{scroll:false});
  };
  const turn=(dir:1|-1)=>{
    setPaging({key:filterKey,pages:dir>0&&next?[...pages,next]:pages.slice(0,-1)});
    top.current?.scrollIntoView({block:"start",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
  };

  return <>
    <header className="sf-catalog-head">
      <h1>{category||"Barcha mahsulotlar"}.</h1>
      <p>{category?"Turkumdagi barcha modellar. Narxlar so‘mda.":"Katalogdagi barcha modellar bir joyda. Narxlar so‘mda."}</p>
    </header>

    <div className="sf-filters" ref={top}>
      <div className="sf-search">
        <label htmlFor="qidiruv" className="sf-visually-hidden">Qidirish</label>
        <SearchIcon/>
        <input id="qidiruv" ref={search} type="search" value={query} maxLength={200} autoComplete="off"
          placeholder="Model, rang yoki xotira" onChange={e=>setQuery(e.target.value)}/>
        {query&&<button type="button" className="sf-search-clear" aria-label="Qidiruvni tozalash" onClick={()=>{setQuery("");search.current?.focus();}}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="currentColor"/><path d="M5.5 5.5l5 5m0-5l-5 5" stroke="var(--sf-bg)" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>}
      </div>
      <div className="sf-chips" role="group" aria-label="Turkum">
        <button type="button" aria-pressed={!category} onClick={()=>setCategory("")}>Barchasi</button>
        {(categories.length?sortCategories(categories):category?[category]:[]).map(c=>
          <button type="button" key={c} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}
      </div>
    </div>

    <p className="sf-visually-hidden" role="status" aria-live="polite">{loading?"Katalog yuklanmoqda":error?"":`${cards.length} ta mahsulot ko‘rsatildi`}</p>

    {error?<div className="sf-state" role="alert">
      <h2>Katalog yuklanmadi.</h2><p>{error}. Internet aloqasini tekshirib, qayta urinib ko‘ring.</p>
      <button type="button" className="sf-btn" onClick={()=>setRetry(r=>r+1)}>Qayta urinish</button>
    </div>:loading&&!cards.length?<div className="sf-grid" aria-hidden="true">
      {Array.from({length:6},(_,i)=><div key={i} className="sf-card sf-skeleton"><div className="sf-card-media"/><div className="sf-card-body"><span/><span/><span/></div></div>)}
    </div>:!cards.length?<div className="sf-state">
      <h2>Hech narsa topilmadi.</h2>
      <p>{query.trim()?`“${query.trim()}” bo‘yicha mos mahsulot yo‘q. Boshqa so‘z bilan qidirib ko‘ring.`:"Bu turkumda hozircha mahsulot yo‘q."}</p>
      {(query||category)&&<button type="button" className="sf-btn sf-btn-ghost" onClick={()=>{setQuery("");setCategory("");}}>Filtrlarni tozalash</button>}
    </div>:<div className={"sf-grid"+(loading?" is-loading":"")} aria-busy={loading}>
      {cards.map(c=><article key={c.id} className="sf-card">
        <Link href={productHref(c.id)} className="sf-card-link">
          <div className="sf-card-media"><ProductVisual image={c.image} name={c.name} category={c.category}/></div>
          <div className="sf-card-body">
            {c.swatches.length>1&&<ul className="sf-dots" aria-label={c.swatches.length+" ta rang"}>
              {c.swatches.slice(0,8).map(s=><li key={s.label} title={s.label} style={swatchStyle(s)}/>)}
            </ul>}
            <p className="sf-eyebrow">{c.category}</p>
            <h2>{c.name}</h2>
            <p className="sf-price">{fromSoum(c.fromPrice)}</p>
            <p className={"sf-stock"+(c.inStock?" is-in":"")}>{c.inStock?"Mavjud":"Hozircha mavjud emas"}</p>
            {c.variants>1&&<p className="sf-card-meta">{c.variants} ta variant</p>}
          </div>
        </Link>
      </article>)}
    </div>}

    {(pages.length>0||next)&&!error&&<nav className="sf-pager" aria-label="Katalog sahifalari">
      {pages.length>0&&<button type="button" className="sf-btn sf-btn-ghost" disabled={loading} onClick={()=>turn(-1)}>Oldingi sahifa</button>}
      <span className="sf-pager-n">{pages.length+1}-sahifa</span>
      {next&&<button type="button" className="sf-btn sf-btn-ghost" disabled={loading} onClick={()=>turn(1)}>Keyingi sahifa</button>}
    </nav>}
  </>;
}

function swatchStyle(s:{label:string;image:string|null}){
  const color=swatchColor(s.label);
  if(color)return {background:color};
  if(s.image)return {backgroundImage:`url("${s.image}")`,backgroundSize:"cover",backgroundPosition:"center"};
  return {background:"conic-gradient(#d2d2d7,#f5f5f7,#d2d2d7)"};
}
