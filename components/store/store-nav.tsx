"use client";
import {useEffect,useState,type CSSProperties} from "react";
import Link from "next/link";
import {usePathname,useSearchParams} from "next/navigation";
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

  return <header className="sf-nav" data-open={open||undefined}>
    <nav className="sf-nav-inner" aria-label="Asosiy">
      <Link href="/" className="sf-brand" aria-label={STORE_NAME+". Bosh sahifa"}><BrandMark/><span>{STORE_NAME}</span></Link>
      <ul className="sf-nav-links">
        {categories.map(c=><li key={c}><Link href={catalogHref(c)} aria-current={current===c?"page":undefined}>{c}</Link></li>)}
      </ul>
      <div className="sf-nav-actions">
        <Link href="/catalog#qidiruv" className="sf-icon-btn" aria-label="Mahsulot qidirish"><SearchIcon/></Link>
        <button type="button" className="sf-icon-btn sf-menu-btn" aria-expanded={open} aria-controls="sf-menu"
          aria-label={open?"Menyuni yopish":"Menyuni ochish"} onClick={()=>setOpen(o=>!o)}>
          <span className="sf-burger" aria-hidden="true"><span/><span/></span>
        </button>
      </div>
    </nav>
    <div id="sf-menu" className="sf-menu" inert={!open}>
      <ul>
        <li style={{"--i":0} as CSSProperties}><Link href="/catalog">Barcha mahsulotlar</Link></li>
        {categories.map((c,i)=><li key={c} style={{"--i":i+1} as CSSProperties}><Link href={catalogHref(c)}>{c}</Link></li>)}
      </ul>
    </div>
  </header>;
}

function BrandMark(){
  return <svg className="sf-brand-mark" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="1" y="1" width="22" height="22" rx="7" fill="currentColor"/>
    <path d="M6.5 16.5V8l5.5 5.5L17.5 8v8.5" fill="none" stroke="var(--sf-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
export function SearchIcon(){
  return <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M13 13l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;
}
