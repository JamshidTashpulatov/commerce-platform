"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {usePathname,useSearchParams} from "next/navigation";
import {SearchIcon} from "lucide-react";
import {cn} from "@/lib/utils";
import {STORE_NAME,catalogHref} from "../../lib/storefront";

export function StoreNav({categories}:{categories:string[]}){
  const [open,setOpen]=useState(false);
  const pathname=usePathname();
  const params=useSearchParams();
  const current=pathname==="/catalog"?params.get("category")??"":null;

  // Close the menu on navigation and with Escape; keep the page still while it is open.
  useEffect(()=>{setOpen(false);},[pathname,params]);
  useEffect(()=>{
    if(!open)return;
    const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false);};
    document.addEventListener("keydown",onKey);
    document.documentElement.classList.add("sf-locked");
    return ()=>{document.removeEventListener("keydown",onKey);document.documentElement.classList.remove("sf-locked");};
  },[open]);

  return <header className="sticky top-0 z-40 h-12 tablet:h-11" data-open={open||undefined}>
    <div aria-hidden="true" className={cn("absolute inset-0 bg-[rgba(250,250,252,0.8)] shadow-[0_1px_0_rgba(0,0,0,0.06)] backdrop-blur-xl backdrop-saturate-[1.8] transition-colors duration-200",open&&"bg-[#fafafc] shadow-none")}/>
    <nav className="relative mx-auto flex h-full max-w-[1068px] items-center gap-2 px-4 tablet:px-[22px]" aria-label="Asosiy">
      <Link href="/" className="mr-auto inline-flex items-center gap-2 text-[17px] font-semibold tracking-[-0.02em] whitespace-nowrap text-sf-ink navbar:mr-0" aria-label={STORE_NAME+". Bosh sahifa"}>
        <BrandMark/><span>{STORE_NAME}</span>
      </Link>
      <ul className="mx-2 ml-8 hidden flex-1 justify-between navbar:flex">
        {categories.map(c=><li key={c}><Link href={catalogHref(c)} aria-current={current===c?"page":undefined}
          className="block px-2.5 text-xs leading-[44px] tracking-[-0.01em] whitespace-nowrap text-black/80 transition-colors hover:text-black aria-[current=page]:font-semibold aria-[current=page]:text-black">{c}</Link></li>)}
      </ul>
      <div className="flex items-center">
        <Link href="/catalog#qidiruv" className="inline-flex size-11 items-center justify-center text-black/80 hover:text-black" aria-label="Katalogdan izlash"><SearchIcon className="size-[17px]" strokeWidth={1.6}/></Link>
        <button type="button" className="inline-flex size-11 cursor-pointer items-center justify-center text-black/80 hover:text-black navbar:hidden"
          aria-expanded={open} aria-controls="sf-menu" aria-label={open?"Menyuni yopish":"Menyuni ochish"} onClick={()=>setOpen(o=>!o)}>
          <span className="relative h-3 w-[18px]" aria-hidden="true">
            <span className={cn("absolute top-0.5 left-0 h-[1.5px] w-[18px] rounded-full bg-current transition-transform duration-300 ease-sf",open&&"translate-y-[3.5px] rotate-45")}/>
            <span className={cn("absolute bottom-0.5 left-0 h-[1.5px] w-[18px] rounded-full bg-current transition-transform duration-300 ease-sf",open&&"-translate-y-[3.5px] -rotate-45")}/>
          </span>
        </button>
      </div>
    </nav>
    <div id="sf-menu" inert={!open} className={cn("fixed inset-x-0 top-12 bottom-0 overflow-y-auto bg-[#fafafc] px-8 pt-4 pb-12 transition-[opacity,visibility] duration-200 navbar:hidden",
      open?"visible opacity-100":"invisible opacity-0")}>
      <ul>
        {[{href:"/catalog",label:"Barcha mahsulotlar"},...categories.map(c=>({href:catalogHref(c),label:c}))].map((l,i)=>
          <li key={l.href} style={{transitionDelay:open?`${i*25+60}ms`:"0ms"}}
            className={cn("transition-[opacity,translate] duration-300 ease-sf",open?"translate-y-0 opacity-100":"-translate-y-2 opacity-0")}>
            <Link href={l.href} className="block py-1.5 text-[28px] leading-8 font-semibold tracking-[0.007em] text-sf-ink">{l.label}</Link>
          </li>)}
      </ul>
    </div>
  </header>;
}

function BrandMark(){
  return <svg className="size-[22px] text-sf-ink" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="1" y="1" width="22" height="22" rx="7" fill="currentColor"/>
    <path d="M6.5 16.5V8l5.5 5.5L17.5 8v8.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
