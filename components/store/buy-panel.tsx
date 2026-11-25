"use client";
import {useMemo,useState,type CSSProperties} from "react";
import type {OptionGroup} from "../../lib/catalog-options";
import type {StoreProductDetail,StoreVariant} from "../../lib/server/storefront";
import {TELEGRAM_URL,isColorGroup,soum,swatchColor} from "../../lib/storefront";
import {ProductVisual} from "./product-visual";

// Picks the stored SKU closest to the current choice when one option changes:
// keep as many other choices as possible, then prefer in stock, then cheaper.
function closest(skus:StoreVariant[],current:StoreVariant,group:string,value:string){
  const score=(v:StoreVariant)=>Object.entries(current.options).filter(([k,val])=>k!==group&&v.options[k]===val).length;
  return skus.filter(v=>v.options[group]===value)
    .sort((a,b)=>score(b)-score(a)||Number(b.inStock)-Number(a.inStock)||(BigInt(a.price)<BigInt(b.price)?-1:1))[0];
}

export function BuyPanel({product}:{product:StoreProductDetail}){
  const {skus,groups}=product;
  const [selectedId,setSelectedId]=useState(()=>(skus.find(v=>v.inStock)??skus[0]).id);
  const selected=skus.find(v=>v.id===selectedId)??skus[0];
  const [viewing,setViewing]=useState<string|null>(null);
  const [copied,setCopied]=useState(false);

  const gallery=useMemo(()=>{
    const list:string[]=[];
    const add=(u:string|null)=>{if(u&&!list.includes(u))list.push(u);};
    for(const g of groups)for(const v of g.values)if(skus.some(s=>s.options[g.name]===v.label))add(v.imageUrl);
    for(const s of skus)add(s.image);
    return list;
  },[groups,skus]);
  const current=viewing&&gallery.includes(viewing)?viewing:selected.image;
  const tone=current?product.tones[current]:undefined;

  const choose=(v:StoreVariant|undefined)=>{if(v){setSelectedId(v.id);setViewing(null);setCopied(false);}};
  const summary=[product.name,...(groups.length?groups.map(g=>selected.options[g.name]):selected.label&&selected.label!=="Standart"?[selected.label]:[])]
    .filter(Boolean).join(", ");
  const copy=async()=>{
    try{await navigator.clipboard.writeText(`${summary}. ${soum(selected.price)}. ${location.href}`);setCopied(true);}catch{setCopied(false);}
  };

  return <div className="sf-buy">
    <div className="sf-gallery">
      <div className="sf-gallery-frame" style={(tone?{"--tile-bg":tone.background}:{}) as CSSProperties}>
        <ProductVisual key={current??"none"} image={current} name={product.name} category={product.category} fit="contain" priority className="sf-fade"/>
      </div>
      {gallery.length>1&&<div className="sf-thumbs" role="group" aria-label="Rasmlar">
        {gallery.map((u,i)=><button type="button" key={u} aria-pressed={u===current} aria-label={`${i+1}-rasm`} onClick={()=>setViewing(u)}
          style={(product.tones[u]?{"--tile-bg":product.tones[u].background}:{}) as CSSProperties}>
          <img src={u} alt="" loading="lazy" referrerPolicy="no-referrer"/>
        </button>)}
      </div>}
    </div>

    <div className="sf-config">
      {[...groups].sort((a,b)=>Number(isColorGroup(b.name))-Number(isColorGroup(a.name))).map(g=><OptionSection key={g.name} group={g} skus={skus} selected={selected} onPick={value=>choose(closest(skus,selected,g.name,value))}/>)}

      {!groups.length&&skus.length>1&&<section className="sf-option">
        <h2 className="sf-option-title"><label htmlFor="sf-variant">Variant. <span>Kerakli turini tanlang.</span></label></h2>
        <div className="sf-select">
          <select id="sf-variant" value={selected.id} onChange={e=>choose(skus.find(v=>v.id===e.target.value))}>
            {skus.map(v=><option key={v.id} value={v.id}>{(v.label||"Variant")+" · "+soum(v.price)}</option>)}
          </select>
        </div>
      </section>}

      <section className="sf-summary" aria-label="Tanlangan mahsulot">
        <p className="sf-summary-name">{summary}</p>
        <p className="sf-summary-price" aria-live="polite">{soum(selected.price)}</p>
        <p className={"sf-stock"+(selected.inStock?" is-in":"")}>{selected.inStock?"Mavjud. Sotuvchi tasdiqlagandan keyin topshiriladi.":"Hozircha mavjud emas. Kelishini sotuvchidan so‘rang."}</p>
        <a className="sf-btn sf-btn-block" href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
          {selected.inStock?"Telegram orqali buyurtma berish":"Telegram orqali so‘rash"}
        </a>
        <button type="button" className="sf-btn sf-btn-ghost sf-btn-block" onClick={copy}>{copied?"Nusxa olindi":"Tanlovdan nusxa olish"}</button>
        <p className="sf-summary-note">Tugma do‘konning Telegram botini ochadi. Tanlovdan nusxa olib, botga yuboring. Onlayn to‘lov yo‘q, yakuniy narxni sotuvchi tasdiqlaydi.</p>
      </section>
    </div>
  </div>;
}

function OptionSection({group,skus,selected,onPick}:{group:OptionGroup;skus:StoreVariant[];selected:StoreVariant;onPick:(value:string)=>void}){
  const color=isColorGroup(group.name);
  const chosen=selected.options[group.name];
  const values=group.values.map(v=>{
    const best=closest(skus,selected,group.name,v.label);
    return {...v,best,exists:!!best};
  });
  const titleId="opt-"+group.name.replace(/\s+/g,"-");
  if(color)return <section className="sf-option" aria-labelledby={titleId}>
    <h2 className="sf-option-title" id={titleId}>{group.name}. <span>{chosen}</span></h2>
    <div className="sf-swatches" role="radiogroup" aria-labelledby={titleId}>
      {values.map(v=><button type="button" role="radio" key={v.label} aria-checked={v.label===chosen} aria-label={v.label+(v.best&&!v.best.inStock?". Mavjud emas":"")}
        disabled={!v.exists} title={v.label} onClick={()=>onPick(v.label)}>
        <span style={swatch(v.label,v.imageUrl)}/>
      </button>)}
    </div>
  </section>;
  return <section className="sf-option" aria-labelledby={titleId}>
    <h2 className="sf-option-title" id={titleId}>{group.name}. <span>{group.affectsPrice?"Narxga ta’sir qiladi.":"Kerakli turini tanlang."}</span></h2>
    <div className="sf-tiles-pick" role="radiogroup" aria-labelledby={titleId}>
      {values.map(v=><button type="button" role="radio" key={v.label} aria-checked={v.label===chosen} disabled={!v.exists} onClick={()=>onPick(v.label)}>
        <span className="sf-pick-label">{v.label}</span>
        {v.best&&(group.affectsPrice||!v.best.inStock)&&<span className="sf-pick-meta">
          {group.affectsPrice&&<span>{soum(v.best.price)}</span>}
          {!v.best.inStock&&<span>Mavjud emas</span>}
        </span>}
        {!v.exists&&<span className="sf-pick-meta"><span>Bu tanlovda yo‘q</span></span>}
      </button>)}
    </div>
  </section>;
}

function swatch(label:string,image:string|null):CSSProperties{
  const color=swatchColor(label);
  if(color)return {background:color};
  if(image)return {backgroundImage:`url("${image}")`,backgroundSize:"cover",backgroundPosition:"center"};
  return {background:"conic-gradient(#d2d2d7,#f5f5f7,#d2d2d7)"};
}
