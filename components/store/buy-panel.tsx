"use client";
import {useMemo,useState,type CSSProperties} from "react";
import {ShoppingBagIcon} from "lucide-react";
import {cn} from "@/lib/utils";
import {NativeSelect,NativeSelectOption} from "@/components/ui/native-select";
import {Separator} from "@/components/ui/separator";
import type {OptionGroup} from "../../lib/catalog-options";
import type {StoreProductDetail,StoreVariant} from "../../lib/server/storefront";
import {bySize,isColorGroup,swatchColor} from "../../lib/storefront";
import {Availability,pill} from "./bits";
import {Gallery} from "./gallery";
import {OneClick} from "./one-click";
import type {TelegramLogin} from "./checkout-form";
import {addToCart} from "../../lib/cart-store";
import {cartUi} from "../../lib/cart-ui";
import {formatMoney} from "../../lib/money";

// Picks the stored SKU closest to the current choice when one option changes:
// keep as many other choices as possible, then prefer in stock, then cheaper.
function closest(skus:StoreVariant[],current:StoreVariant,group:string,value:string){
  const score=(v:StoreVariant)=>Object.entries(current.options).filter(([k,val])=>k!==group&&v.options[k]===val).length;
  return skus.filter(v=>v.options[group]===value)
    .sort((a,b)=>score(b)-score(a)||Number(b.inStock)-Number(a.inStock)||(BigInt(a.price)<BigInt(b.price)?-1:1))[0];
}

const sectionTitle="mb-5 text-[21px] leading-[1.19] font-semibold tracking-[0.011em] tablet:text-2xl tablet:leading-[1.17]";

export function BuyPanel({product,checkout}:{product:StoreProductDetail;checkout:{enabled:boolean;telegram:TelegramLogin}}){
  const {skus,groups}=product;
  const [selectedId,setSelectedId]=useState(()=>(skus.find(v=>v.inStock)??skus[0]).id);
  const selected=skus.find(v=>v.id===selectedId)??skus[0];
  const [viewing,setViewing]=useState<number|null>(null);

  const gallery=useMemo(()=>{
    const list:string[]=[];
    const add=(u:string|null)=>{if(u&&!list.includes(u))list.push(u);};
    for(const g of groups)for(const v of g.values)if(skus.some(s=>s.options[g.name]===v.label))add(v.imageUrl);
    for(const s of skus)add(s.image);
    return list;
  },[groups,skus]);
  const selectedIndex=Math.max(0,selected.image?gallery.indexOf(selected.image):0);
  const index=viewing!==null&&viewing<gallery.length?viewing:selectedIndex;

  const choose=(v:StoreVariant|undefined)=>{if(v){setSelectedId(v.id);setViewing(null);}};
  const ordered=[...groups].sort((a,b)=>Number(isColorGroup(b.name))-Number(isColorGroup(a.name)));
  const summary=[product.name,...(groups.length?ordered.map(g=>selected.options[g.name]):selected.label&&selected.label!=="Standart"?[selected.label]:[])]
    .filter(Boolean).join(", ");

  return <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 desktop:grid-cols-[minmax(0,1fr)_360px] desktop:gap-14">
    <Gallery images={gallery} index={index} onIndex={setViewing} name={product.name} category={product.category} tones={product.tones}/>

    <div className="flex min-w-0 flex-col">
      {ordered.map((g,i)=><div key={g.name}>
        {i>0&&<Separator className="my-8 bg-sf-line/70"/>}
        <OptionSection group={g} skus={skus} selected={selected} onPick={value=>choose(closest(skus,selected,g.name,value))}/>
      </div>)}

      {!groups.length&&skus.length>1&&<section>
        <h2 className={sectionTitle}><label htmlFor="sf-variant">Variant. <span className="text-sf-ink-2">Kerakli turini tanlang.</span></label></h2>
        <NativeSelect id="sf-variant" value={selected.id} onChange={e=>choose(skus.find(v=>v.id===e.target.value))}
          className="w-full [&_select]:h-14 [&_select]:rounded-xl [&_select]:border-sf-line [&_select]:bg-white [&_select]:pr-11 [&_select]:pl-[18px] [&_select]:text-[17px] [&_select]:focus-visible:border-sf-blue [&_svg]:right-4">
          {skus.map(v=><NativeSelectOption key={v.id} value={v.id}>{(v.label||"Variant")+" · "+formatMoney(v.price)}</NativeSelectOption>)}
        </NativeSelect>
      </section>}

      <section className={cn("flex flex-col rounded-[18px] bg-sf-alt p-6 tablet:p-7",(groups.length||skus.length>1)&&"mt-10")} aria-label="Tanlangan mahsulot">
        <p className="text-sm leading-5 text-sf-ink-2">{summary}</p>
        <p className="mt-2 text-[28px] leading-[1.14] font-semibold tracking-[0.007em] tabular-nums" aria-live="polite">{formatMoney(selected.price)}</p>
        <Availability inStock={selected.inStock} long className="mt-3 text-sm leading-5 [&>span:first-child]:mt-[7px]"/>
        <div className="mt-6 flex flex-col gap-3">
          <button type="button" className={pill({className:"w-full gap-2"})} onClick={()=>{addToCart({variantId:selected.id,productId:product.id,seenPrice:selected.price});cartUi.open();}}>
            <ShoppingBagIcon className="size-[18px]" aria-hidden="true"/>Savatga qo‘shish
          </button>
          <OneClick variantId={selected.id} productName={product.name} options={ordered.map(g=>selected.options[g.name]).filter(Boolean).join(", ")||(selected.label!=="Standart"?selected.label:"")}
            enabled={checkout.enabled} telegram={checkout.telegram}/>
        </div>
        {!selected.inStock&&<p className="mt-3 text-xs leading-[1.5] text-sf-ink-2">Hozir omborda yo‘q. So‘rov qoldirsangiz, sotuvchi kelish muddatini aytadi.</p>}
      </section>
    </div>
  </div>;
}

function OptionSection({group,skus,selected,onPick}:{group:OptionGroup;skus:StoreVariant[];selected:StoreVariant;onPick:(value:string)=>void}){
  const color=isColorGroup(group.name);
  const chosen=selected.options[group.name];
  const values=bySize(group.values,v=>v.label).map(v=>({...v,best:closest(skus,selected,group.name,v.label)}));
  const titleId="opt-"+group.name.replace(/\s+/g,"-");
  if(color)return <section aria-labelledby={titleId}>
    <h2 className={sectionTitle} id={titleId}>{group.name}. <span className="text-sf-ink-2">{chosen}</span></h2>
    <div className="flex flex-wrap gap-3" role="radiogroup" aria-labelledby={titleId}>
      {values.map(v=><button type="button" role="radio" key={v.label} aria-checked={v.label===chosen} title={v.label}
        aria-label={v.label+(v.best&&!v.best.inStock?". Mavjud emas":"")} disabled={!v.best} onClick={()=>onPick(v.label)}
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full transition-[box-shadow,scale] duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 aria-checked:shadow-[0_0_0_2px_var(--color-sf-blue)]">
        <span className="size-8 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.14),inset_0_2px_4px_rgba(0,0,0,0.08)]" style={swatch(v.label,v.imageUrl)}/>
      </button>)}
    </div>
  </section>;
  return <section aria-labelledby={titleId}>
    <h2 className={sectionTitle} id={titleId}>{group.name}. <span className="text-sf-ink-2">{group.affectsPrice?"Narxga ta’sir qiladi.":"Kerakli turini tanlang."}</span></h2>
    <div className="grid gap-3" role="radiogroup" aria-labelledby={titleId}>
      {values.map(v=><button type="button" role="radio" key={v.label} aria-checked={v.label===chosen} disabled={!v.best} onClick={()=>onPick(v.label)}
        className="flex min-h-16 cursor-pointer items-center justify-between gap-4 rounded-xl border border-sf-line bg-white px-[18px] py-4 text-left transition-[border-color,box-shadow,scale] duration-200 hover:border-sf-ink-3 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40 aria-checked:border-sf-blue aria-checked:shadow-[0_0_0_1px_var(--color-sf-blue)]">
        <span className="text-[17px] font-semibold">{v.label}</span>
        <span className="flex flex-col items-end gap-0.5 text-right text-xs leading-4 text-sf-ink-2">
          {v.best&&group.affectsPrice&&<span>{formatMoney(v.best.price)}</span>}
          {v.best&&!v.best.inStock&&<span>Mavjud emas</span>}
          {!v.best&&<span>Bu tanlovda yo‘q</span>}
        </span>
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
