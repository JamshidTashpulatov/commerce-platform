"use client";
import {useEffect,useMemo,useState,type CSSProperties,type ReactNode} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {CheckIcon,LinkIcon,PlusIcon,XIcon,ScaleIcon} from "lucide-react";
import {cn} from "@/lib/utils";
import {Switch} from "@/components/ui/switch";
import {Empty,EmptyContent,EmptyDescription,EmptyHeader,EmptyMedia,EmptyTitle} from "@/components/ui/empty";
import {compareHref,compareStore} from "../../lib/compare-store";
import {productHref,swatchColor} from "../../lib/storefront";
import {ProductVisual} from "./product-visual";
import {Availability,eyebrow,pill} from "./bits";
import {formatFrom,formatMoney} from "../../lib/money";

export type CompareProduct={id:string;name:string;category:string;image:string|null;fromPrice:string;toPrice:string;
  inStock:boolean;inStockCount:number;variants:number;colors:{label:string;image:string|null}[];groups:Record<string,string[]>};
export type Sibling={id:string;name:string;category:string;image:string|null;fromPrice:string};
type Row={key:string;label:string;hint?:string;cells:ReactNode[];same:boolean};

const swatch=(label:string,image:string|null):CSSProperties=>{
  const color=swatchColor(label);
  if(color)return {background:color};
  if(image)return {backgroundImage:`url("${image}")`,backgroundSize:"cover",backgroundPosition:"center"};
  return {background:"conic-gradient(#d2d2d7,#f5f5f7,#d2d2d7)"};
};
const norm=(values:string[])=>JSON.stringify(values.map(v=>v.toLowerCase().trim()).sort());

export function CompareView({products,siblings,max}:{products:CompareProduct[];siblings:Sibling[];max:number}){
  const router=useRouter();
  const [onlyDiff,setOnlyDiff]=useState(false);
  const [copied,setCopied]=useState(false);
  const ids=products.map(p=>p.id);

  // The URL is the source of truth for this page; mirror it into the tray store.
  useEffect(()=>{compareStore.set(products.map(p=>({id:p.id,name:p.name,category:p.category,image:p.image})));},[products]);

  const go=(next:string[])=>router.replace(next.length?compareHref(next):"/compare",{scroll:false});
  const mixed=new Set(products.map(p=>p.category)).size>1;

  // Most decision-relevant rows first: price, availability, colour, then the option groups.
  const rows=useMemo<Row[]>(()=>{
    const list:Row[]=[];
    const push=(key:string,label:string,values:string[][],cells:ReactNode[],hint?:string)=>
      list.push({key,label,hint,cells,same:products.length<2||values.every(v=>norm(v)===norm(values[0]))});
    push("from","Boshlang‘ich narx",products.map(p=>[p.fromPrice]),products.map(p=><span key={p.id} className="text-[17px] font-semibold tabular-nums">{formatMoney(p.fromPrice)}</span>));
    push("range","Narx oralig‘i",products.map(p=>[p.fromPrice,p.toPrice]),products.map(p=><span key={p.id} className="tabular-nums">{p.fromPrice===p.toPrice?"Bitta narx":`${formatMoney(p.fromPrice)} dan ${formatMoney(p.toPrice)} gacha`}</span>),"Variantlar bo‘yicha eng arzon va eng qimmat narx.");
    push("stock","Mavjudlik",products.map(p=>[String(p.inStock),String(p.inStockCount)]),products.map(p=><div key={p.id} className="flex flex-col items-center gap-1">
      <Availability inStock={p.inStock} always className="text-sm"/>
      <span className="text-xs text-sf-ink-3">{p.inStock?`${p.inStockCount} / ${p.variants} variant omborda`:"Kelishini sotuvchidan so‘rang"}</span>
    </div>));
    if(products.some(p=>p.colors.length))push("colors","Ranglar",products.map(p=>p.colors.map(c=>c.label)),products.map(p=>p.colors.length?<div key={p.id} className="flex flex-col items-center gap-2">
      <ul className="flex flex-wrap justify-center gap-1.5">{p.colors.map(c=><li key={c.label} title={c.label} className="size-4 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.14)]" style={swatch(c.label,c.image)}/>)}</ul>
      <span className="text-xs text-sf-ink-2">{p.colors.map(c=>c.label).join(", ")}</span>
    </div>:<span key={p.id} className="text-sf-ink-3">Bitta rang</span>));
    const groupNames=[...new Set(products.flatMap(p=>Object.keys(p.groups)))];
    for(const name of groupNames)push("g:"+name,name,products.map(p=>p.groups[name]??[]),products.map(p=>p.groups[name]?.length?
      <ul key={p.id} className="flex flex-wrap justify-center gap-1.5">{p.groups[name].map(v=><li key={v} className="rounded-full bg-sf-alt px-2.5 py-1 text-xs">{v}</li>)}</ul>
      :<span key={p.id} className="text-sf-ink-3">Tanlov yo‘q</span>));
    push("variants","Variantlar soni",products.map(p=>[String(p.variants)]),products.map(p=><span key={p.id} className="tabular-nums">{p.variants}</span>));
    return list;
  },[products]);
  const diffCount=rows.filter(r=>!r.same).length;
  const visible=onlyDiff?rows.filter(r=>!r.same):rows;

  if(!products.length)return <div className="pt-16">
    <Empty className="rounded-[18px] bg-sf-alt py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon"><ScaleIcon/></EmptyMedia>
        <EmptyTitle className="text-[28px] leading-[1.14] font-semibold">Solishtirish uchun mahsulot tanlang.</EmptyTitle>
        <EmptyDescription className="text-[17px] text-sf-ink-2">Katalogda yoki mahsulot sahifasida “Solishtirish” belgisini bosing. Bir turkumdan {max} tagacha model tanlash mumkin.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent><Link className={pill()} href="/catalog">Katalogga o‘tish</Link></EmptyContent>
    </Empty>
  </div>;

  const cols=products.length+(products.length<max&&siblings.length?1:0);
  const grid={gridTemplateColumns:`repeat(${cols}, minmax(0,1fr))`};
  const track="grid gap-4 min-w-[calc(var(--cols)*50%-8px)] tablet:min-w-0 tablet:gap-6";
  const share=async()=>{try{await navigator.clipboard.writeText(location.href);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{setCopied(false);}};

  return <div style={{"--cols":cols} as CSSProperties}>
    <header className="pt-10 pb-6 text-center tablet:pt-16 tablet:pb-10">
      <p className={eyebrow}>{mixed?"Turli turkumlar":products[0].category}</p>
      <h1 className="mt-1 text-[40px] leading-[1.1] font-semibold tablet:text-5xl tablet:leading-[1.08]">Solishtirish.</h1>
      <p className="mx-auto mt-3 max-w-[560px] text-[17px] text-sf-ink-2 tablet:text-[19px]">
        {products.length<2?"Yana bitta model qo‘shing, farqlar shu yerda ko‘rinadi.":diffCount?`${diffCount} ta ko‘rsatkichda farq bor. Ular belgilab qo‘yilgan.`:"Tanlangan modellar bu ko‘rsatkichlarda bir xil."}
      </p>
      {mixed&&<p className="mx-auto mt-2 max-w-[560px] text-sm text-sf-ink-3">Bir turkum ichida solishtirish aniqroq natija beradi.</p>}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        {products.length>1&&<label className="inline-flex cursor-pointer items-center gap-2.5 text-sm">
          <Switch checked={onlyDiff} onCheckedChange={setOnlyDiff} className="data-checked:bg-sf-blue"/>Faqat farqlarni ko‘rsatish
        </label>}
        <button type="button" onClick={share} className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-sf-link hover:underline">
          {copied?<CheckIcon className="size-4"/>:<LinkIcon className="size-4"/>}{copied?"Havola nusxalandi":"Havolani ulashish"}
        </button>
      </div>
    </header>

    <div className="sf-no-scrollbar -mx-4 snap-x snap-mandatory overflow-x-auto px-4 tablet:mx-0 tablet:overflow-visible tablet:px-0">
      {/* Product headers */}
      <div className={track} style={grid}>
        {products.map(p=><div key={p.id} className="relative flex snap-start flex-col items-center text-center">
          <button type="button" aria-label={p.name+"ni solishtirishdan olib tashlash"} onClick={()=>go(ids.filter(i=>i!==p.id))}
            className="absolute top-2 right-2 z-10 inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-white/90 text-sf-ink-2 shadow-sm ring-1 ring-black/5 hover:text-sf-ink"><XIcon className="size-4"/></button>
          <Link href={productHref(p.id)} data-tone className="relative block aspect-square w-full overflow-hidden rounded-[18px] bg-sf-alt">
            <ProductVisual image={p.image} name={p.name} category={p.category} fit="blend" sizes="(min-width:735px) 300px, 50vw" className="absolute inset-0"/>
          </Link>
          <h2 className="mt-5 text-[19px] leading-[1.21] font-semibold tablet:text-2xl">{p.name}</h2>
          <p className="mt-1 text-sm">{formatFrom(p.fromPrice)}</p>
          <Link className={cn(pill({size:"sm"}),"mt-4")} href={productHref(p.id)}>Tanlash</Link>
        </div>)}
        {cols>products.length&&<AddColumn siblings={siblings} onAdd={id=>go([...ids,id])}/>}
      </div>

      {/* Sticky names on wide screens, so every row stays readable while scrolling. */}
      <div className="sticky top-11 z-20 -mx-[22px] mt-10 hidden border-b border-sf-line/70 bg-white/85 px-[22px] py-3 backdrop-blur-xl tablet:block">
        <div className="grid gap-6" style={grid}>{products.map(p=><p key={p.id} className="truncate text-center text-sm font-semibold">{p.name}</p>)}</div>
      </div>

      <div className="mt-6 tablet:mt-0" role="table" aria-label="Solishtirish jadvali">
        {visible.map(r=><div key={r.key} role="row" className={cn("border-b border-sf-line/70 py-6",!r.same&&"bg-linear-to-b from-sf-blue/[0.035] to-transparent")}>
          <div className="sticky left-0 mb-4 flex w-[calc(100vw-32px)] items-center justify-center gap-2 tablet:w-auto" role="rowheader">
            <span className="text-xs font-semibold tracking-[0.02em] text-sf-ink-2 uppercase">{r.label}</span>
            {!r.same&&<span className="rounded-full bg-sf-blue/10 px-2 py-0.5 text-[11px] font-semibold text-sf-blue">Farq bor</span>}
          </div>
          {r.hint&&<p className="sticky left-0 -mt-2 mb-4 w-[calc(100vw-32px)] text-center text-xs text-sf-ink-3 tablet:w-auto">{r.hint}</p>}
          <div className={track} style={grid}>
            {r.cells.map((c,i)=><div key={i} role="cell" className="flex snap-start flex-col items-center gap-1 text-center text-sm">
              <span className="mb-1 text-[11px] text-sf-ink-3 tablet:hidden">{products[i].name}</span>{c}
            </div>)}
            {cols>products.length&&<div aria-hidden="true"/>}
          </div>
        </div>)}
        {onlyDiff&&!visible.length&&<p className="py-10 text-center text-sf-ink-2">Ko‘rsatilgan ko‘rsatkichlarda farq yo‘q.</p>}
      </div>
    </div>
    <p className="mt-8 text-center text-xs text-sf-ink-3">Solishtirish katalogdagi narx, rang, variant va mavjudlik ma’lumotlariga asoslangan.</p>
  </div>;
}

function AddColumn({siblings,onAdd}:{siblings:Sibling[];onAdd:(id:string)=>void}){
  const top=siblings.slice(0,4);
  return <div className="flex snap-start flex-col rounded-[18px] border border-dashed border-sf-line p-4 tablet:p-5">
    <p className="text-sm font-semibold">Yana qo‘shish</p>
    <p className="mt-1 text-xs text-sf-ink-2">Narxi eng yaqin modellar:</p>
    <ul className="mt-4 flex flex-col gap-2">
      {top.map(s=><li key={s.id}>
        <button type="button" onClick={()=>onAdd(s.id)} className="group flex w-full cursor-pointer items-center gap-3 rounded-xl p-1.5 text-left transition-colors hover:bg-sf-alt">
          <span data-tone className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-sf-alt"><ProductVisual image={s.image} name={s.name} category={s.category} fit="blend" sizes="44px" cutoutPadding={false} className="absolute inset-0"/></span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{s.name}</span><span className="block text-xs text-sf-ink-2">{formatFrom(s.fromPrice)}</span></span>
          <PlusIcon className="size-4 shrink-0 text-sf-blue" aria-hidden="true"/>
        </button>
      </li>)}
    </ul>
  </div>;
}
