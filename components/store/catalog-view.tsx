"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import {usePathname,useRouter,useSearchParams} from "next/navigation";
import {SearchIcon,XCircleIcon,SearchXIcon,WifiOffIcon} from "lucide-react";
import {cn} from "@/lib/utils";
import {Input} from "@/components/ui/input";
import {Skeleton} from "@/components/ui/skeleton";
import {Empty,EmptyContent,EmptyDescription,EmptyHeader,EmptyMedia,EmptyTitle} from "@/components/ui/empty";
import type {OptionGroup,OptionSelection} from "../../lib/catalog-options";
import {fromSoum,isColorGroup,productHref,sortCategories,swatchColor} from "../../lib/storefront";
import {ProductVisual} from "./product-visual";
import {Availability,eyebrow,pill} from "./bits";
import {CompareToggle} from "./compare-toggle";
import {ShoppingBagIcon} from "lucide-react";
import {addToCart} from "../../lib/cart-store";
import {cartUi} from "../../lib/cart-ui";
import {scrollToElement} from "../../lib/smooth-scroll";

type Row={id:string;name:string;category:string;description:string;image_url:string|null;variant_id:string;color:string;
  storage_label:string|null;price_uzs:string;in_stock:boolean;option_groups:OptionGroup[];option_values:OptionSelection};
type Card={id:string;name:string;category:string;image:string|null;fromPrice:string;inStock:boolean;variants:number;onlyVariant:string|null;
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
      inStock:list.some(r=>r.in_stock),variants:list.length,onlyVariant:list.length===1?head.variant_id:null,swatches};
  });
}

const chip="h-9 flex-none cursor-pointer rounded-full border border-sf-line bg-white px-4 text-sm tracking-[-0.016em] text-sf-ink transition-[background-color,border-color,color,scale] duration-200 hover:border-sf-ink-3 active:scale-[0.97] aria-pressed:border-sf-ink aria-pressed:bg-sf-ink aria-pressed:text-white";

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
    if(top.current)scrollToElement(top.current);
  };

  return <>
    <header className="pt-10 pb-5 tablet:pt-16 tablet:pb-7">
      <h1 className="text-[40px] leading-[1.1] font-semibold tablet:text-5xl tablet:leading-[1.08] tablet:tracking-[-0.003em]">{category||"Barcha mahsulotlar"}.</h1>
      <p className="mt-2 text-[19px] leading-[1.21] text-sf-ink-2 tablet:text-[21px]">{category?"Turkumdagi barcha modellar. Narxlar so‘mda.":"Katalogdagi barcha modellar bir joyda. Narxlar so‘mda."}</p>
    </header>

    <div ref={top} className="flex scroll-mt-16 flex-col gap-4 pb-7">
      <div className="relative flex max-w-[520px] items-center text-sf-ink-2">
        <label htmlFor="qidiruv" className="sr-only">Qidirish</label>
        <SearchIcon className="pointer-events-none absolute left-3.5 size-[17px]" strokeWidth={1.6} aria-hidden="true"/>
        <Input id="qidiruv" ref={search} type="search" value={query} maxLength={200} autoComplete="off"
          placeholder="Model, rang yoki xotira" onChange={e=>setQuery(e.target.value)}
          className="h-11 rounded-xl border-sf-line bg-white px-10 text-[17px] tracking-[-0.022em] text-sf-ink placeholder:text-sf-ink-3 focus-visible:border-sf-blue focus-visible:ring-sf-blue/20 md:text-[17px] [&::-webkit-search-cancel-button]:hidden"/>
        {query&&<button type="button" className="absolute right-1.5 inline-flex size-8 cursor-pointer items-center justify-center text-sf-ink-3 hover:text-sf-ink-2"
          aria-label="Qidiruvni tozalash" onClick={()=>{setQuery("");search.current?.focus();}}><XCircleIcon className="size-[18px]" aria-hidden="true"/></button>}
      </div>
      <div className="sf-no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-0.5 tablet:-mx-[22px] tablet:px-[22px]" role="group" aria-label="Turkum">
        <button type="button" className={chip} aria-pressed={!category} onClick={()=>setCategory("")}>Barchasi</button>
        {(categories.length?sortCategories(categories):category?[category]:[]).map(c=>
          <button type="button" key={c} className={chip} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}
      </div>
    </div>

    <p className="sr-only" role="status" aria-live="polite">{loading?"Katalog yuklanmoqda":error?"":`${cards.length} ta mahsulot ko‘rsatildi`}</p>

    {error?<Empty className="rounded-[18px] bg-sf-alt py-16" role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon"><WifiOffIcon/></EmptyMedia>
        <EmptyTitle className="text-[28px] leading-[1.14] font-semibold">Katalog yuklanmadi.</EmptyTitle>
        <EmptyDescription className="text-[17px] text-sf-ink-2">{error}. Internet aloqasini tekshirib, qayta urinib ko‘ring.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent><button type="button" className={pill()} onClick={()=>setRetry(r=>r+1)}>Qayta urinish</button></EmptyContent>
    </Empty>
    :loading&&!cards.length?<div className="grid grid-cols-1 gap-5 min-[640px]:grid-cols-2 navbar:grid-cols-3" aria-hidden="true">
      {Array.from({length:6},(_,i)=><div key={i} className="overflow-hidden rounded-[18px] bg-sf-alt">
        <Skeleton className="aspect-3/2 rounded-none bg-[#ececf0]"/>
        <div className="flex flex-col gap-3 px-6 pt-5 pb-6"><Skeleton className="h-3 w-1/3 bg-[#e6e6ea]"/><Skeleton className="h-5 w-2/3 bg-[#e6e6ea]"/><Skeleton className="h-3 w-1/2 bg-[#e6e6ea]"/></div>
      </div>)}
    </div>
    :!cards.length?<Empty className="rounded-[18px] bg-sf-alt py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon"><SearchXIcon/></EmptyMedia>
        <EmptyTitle className="text-[28px] leading-[1.14] font-semibold">Hech narsa topilmadi.</EmptyTitle>
        <EmptyDescription className="text-[17px] text-sf-ink-2">{query.trim()?`“${query.trim()}” bo‘yicha mos mahsulot yo‘q. Boshqa so‘z bilan qidirib ko‘ring.`:"Bu turkumda hozircha mahsulot yo‘q."}</EmptyDescription>
      </EmptyHeader>
      {(query||category)&&<EmptyContent><button type="button" className={pill({tone:"ghost"})} onClick={()=>{setQuery("");setCategory("");}}>Filtrlarni tozalash</button></EmptyContent>}
    </Empty>
    :<div className={cn("grid grid-cols-1 gap-5 transition-opacity duration-200 min-[640px]:grid-cols-2 navbar:grid-cols-3",loading&&"opacity-50")} aria-busy={loading}>
      {cards.map(c=><article key={c.id} className="flex flex-col rounded-[18px] bg-sf-alt">
        <Link href={productHref(c.id)} className="flex flex-1 flex-col overflow-hidden rounded-t-[18px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sf-blue">
          <div className="relative aspect-3/2 bg-sf-alt">
            <ProductVisual image={c.image} name={c.name} category={c.category} sizes="(min-width:1069px) 320px, (min-width:834px) 33vw, (min-width:640px) 50vw, 100vw" className="absolute inset-0"/>
          </div>
          <div className="flex flex-1 flex-col gap-1 px-6 pt-5 pb-6">
            {c.swatches.length>1&&<ul className="mb-2.5 flex gap-1.5" aria-label={c.swatches.length+" ta rang"}>
              {c.swatches.slice(0,8).map(s=><li key={s.label} title={s.label} className="size-3 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" style={swatchStyle(s)}/>)}
            </ul>}
            <p className={eyebrow}>{c.category}</p>
            <h2 className="mb-1.5 text-[21px] leading-[1.19] font-semibold tracking-[0.011em] [overflow-wrap:anywhere]">{c.name}</h2>
            <p className="text-sm">{fromSoum(c.fromPrice)}</p>
            <Availability inStock={c.inStock} className="mt-1.5"/>
            {c.variants>1&&<p className="text-xs text-sf-ink-3">{c.variants} ta variant</p>}
          </div>
        </Link>
        <div className="flex items-center justify-between gap-3 border-t border-black/5 px-6 py-3.5">
          <CompareToggle item={{id:c.id,name:c.name,category:c.category,image:c.image}}/>
          {c.onlyVariant&&<button type="button" aria-label={c.name+"ni savatga qo‘shish"} onClick={()=>{addToCart({variantId:c.onlyVariant!,productId:c.id,seenPrice:c.fromPrice});cartUi.open();}}
            className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-sf-blue hover:underline"><ShoppingBagIcon className="size-3.5" aria-hidden="true"/>Savatga</button>}
        </div>
      </article>)}
    </div>}

    {(pages.length>0||next)&&!error&&<nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 pt-10" aria-label="Katalog sahifalari">
      {pages.length>0&&<button type="button" className={pill({tone:"ghost",size:"sm"})} disabled={loading} onClick={()=>turn(-1)}>Oldingi sahifa</button>}
      <span className="text-sm text-sf-ink-2 tabular-nums">{pages.length+1}-sahifa</span>
      {next&&<button type="button" className={pill({tone:"ghost",size:"sm"})} disabled={loading} onClick={()=>turn(1)}>Keyingi sahifa</button>}
    </nav>}
  </>;
}

function swatchStyle(s:{label:string;image:string|null}){
  const color=swatchColor(s.label);
  if(color)return {background:color};
  if(s.image)return {backgroundImage:`url("${s.image}")`,backgroundSize:"cover",backgroundPosition:"center"};
  return {background:"conic-gradient(#d2d2d7,#f5f5f7,#d2d2d7)"};
}
