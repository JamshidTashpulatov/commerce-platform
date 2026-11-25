import Link from "next/link";
import type {CSSProperties} from "react";
import {ChevronRightIcon} from "lucide-react";
import {cn} from "@/lib/utils";
import {Card} from "@/components/ui/card";
import {ProductVisual} from "../../components/store/product-visual";
import {Shelf} from "../../components/store/shelf";
import {Availability,eyebrow,pill,wrap} from "../../components/store/bits";
import {listProducts,sortCategories,type StoreProduct,type Tone} from "../../lib/server/storefront";
import {STORE_NAME,STORE_TAGLINE,TELEGRAM_URL,catalogHref,productHref} from "../../lib/storefront";
import {pageMeta} from "../../lib/server/seo";
import {formatFrom} from "../../lib/money";

export const dynamic="force-dynamic";
export const metadata=pageMeta({title:STORE_NAME+". "+STORE_TAGLINE,absoluteTitle:true,path:"/",
  description:"iPhone, iPad, Mac, Apple Watch, AirPods va aksessuarlar bir joyda. Narxlar dollarda, buyurtma saytda, sotuvchi qo‘ng‘iroq qilib tasdiqlaydi."});

// Uploaded photos lend their edge colour to the tile, so the photo bleeds into it.
const toneStyle=(tone:Tone|null,fallback:string)=>({"--tile-bg":tone?.background??fallback}) as CSSProperties;

// The most expensive product with a photo leads each category.
function flagships(products:StoreProduct[]){
  const byCategory=new Map<string,StoreProduct[]>();
  for(const p of products)byCategory.set(p.category,[...(byCategory.get(p.category)??[]),p]);
  return sortCategories([...byCategory.keys()]).map(category=>{
    const list=byCategory.get(category)!;
    const pick=[...list].sort((a,b)=>Number(!!b.image)-Number(!!a.image)||(BigInt(b.fromPrice)>BigInt(a.fromPrice)?1:BigInt(b.fromPrice)<BigInt(a.fromPrice)?-1:0))[0];
    return {category,count:list.length,product:pick};
  });
}

export default async function Home(){
  let products:StoreProduct[]=[];let failed=false;
  try{products=await listProducts();}catch{failed=true;}
  const leads=flagships(products);
  const heroIndex=Math.max(0,leads.findIndex(l=>l.category.toLowerCase()==="iphone"));
  const hero=leads[heroIndex];
  const tiles=leads.filter((_,i)=>i!==heroIndex);
  const shelf=[...products].sort((a,b)=>Number(!!b.image)-Number(!!a.image)||Number(b.inStock)-Number(a.inStock)).slice(0,12);

  if(!hero)return <section className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 py-20 text-center">
    <h1 className="text-[40px] leading-[1.1] font-semibold">{failed?"Katalog vaqtincha ochilmadi.":"Mahsulotlar tez orada."}</h1>
    <p className="mb-3 max-w-[520px] text-[19px] text-sf-ink-2">{failed?"Birozdan keyin sahifani yangilang yoki Telegram orqali yozing.":"Hozircha e’lon qilingan mahsulot yo‘q. Savollar bo‘lsa, Telegram orqali yozing."}</p>
    <a className={pill()} href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">Telegram’da yozish</a>
  </section>;

  const heroDark=!!hero.product.tone?.dark;
  return <>
    <section data-tone className={cn("flex flex-col items-center overflow-hidden bg-(--tile-bg) pt-12 text-center tablet:pt-14",heroDark&&"text-[#f5f5f7]")}
      style={toneStyle(hero.product.tone,"#fff")} aria-labelledby="hero-title">
      <div className="flex flex-col items-center gap-1.5 px-4">
        <p className={cn(eyebrow,"text-sm",heroDark&&"text-[#a1a1a6]")}>{hero.category}</p>
        <h1 id="hero-title" className="text-[40px] leading-[1.1] font-semibold tracking-normal tablet:text-[56px] tablet:leading-[1.07] tablet:tracking-[-0.005em]">{hero.product.name}</h1>
        <p className="mb-4 text-[21px] leading-[1.19] tracking-[0.011em] tablet:text-[28px] tablet:leading-[1.14]">{formatFrom(hero.product.fromPrice)}. Savatga qo‘shing yoki bir bosishda xarid qiling.</p>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-3">
          <Link className={pill()} href={productHref(hero.product.id)}>Batafsil</Link>
          <Link className={pill({tone:"ghost",dark:heroDark})} href={catalogHref(hero.category)}>Barcha {hero.category}</Link>
        </div>
      </div>
      <Link href={productHref(hero.product.id)} tabIndex={-1} aria-hidden="true"
        className="relative mt-8 block aspect-4/3 w-full max-w-[1180px] tablet:aspect-video tablet:max-h-[72vh]">
        <ProductVisual image={hero.product.image} name={hero.product.name} category={hero.category} priority fit="blend" sizes="(min-width:1180px) 1180px, 100vw" className="absolute inset-0"/>
      </Link>
    </section>

    {tiles.length>0&&<section className="grid gap-3 p-3 desktop:grid-cols-2" aria-label="Turkumlar bo‘yicha tanlov">
      {tiles.map(({category,count,product},i)=>{
        const dark=!!product.tone?.dark;
        const wide=tiles.length%2===1&&i===tiles.length-1;
        return <article key={category} data-tone style={toneStyle(product.tone,"#f5f5f7")}
          className={cn("sf-reveal group flex flex-col items-center overflow-hidden bg-(--tile-bg) text-center",wide&&"desktop:col-span-2",dark&&"text-[#f5f5f7]")}>
          <div className="flex flex-1 flex-col items-center gap-1 px-4 pt-11">
            <p className={cn(eyebrow,dark&&"text-[#a1a1a6]")}>{category}</p>
            <h2 className="text-[32px] leading-[1.125] font-semibold tracking-[0.004em] tablet:text-[40px] tablet:leading-[1.1] tablet:tracking-normal">{product.name}</h2>
            <p className="mb-4 text-[19px] leading-[1.21] tracking-[0.012em] tablet:text-[21px]">{formatFrom(product.fromPrice)}{count>1?`. Turkumda ${count} ta model.`:"."}</p>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-2">
              <Link className={pill({size:"sm"})} href={productHref(product.id)} aria-label={product.name+" haqida batafsil"}>Batafsil</Link>
              <Link className={pill({tone:"ghost",size:"sm",dark})} href={catalogHref(category)} aria-label={"Barcha "+category+" mahsulotlari"}>Barchasi</Link>
            </div>
          </div>
          <Link href={productHref(product.id)} tabIndex={-1} aria-hidden="true"
            className={cn("relative mt-7 block aspect-4/3 w-full overflow-hidden tablet:aspect-16/10",wide&&"desktop:aspect-16/7 desktop:max-w-[1110px]")}>
            <ProductVisual image={product.image} name={product.name} category={category} fit="blend"
              className="absolute inset-0 transition-transform duration-[900ms] ease-sf pointer-fine:group-hover:scale-[1.025]"/>
          </Link>
        </article>;
      })}
    </section>}

    <section className="pt-16 pb-6 tablet:pt-[88px] tablet:pb-8" aria-labelledby="shelf-title">
      <div className={cn(wrap,"mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3")}>
        <h2 id="shelf-title" className="max-w-[640px] text-2xl leading-[1.17] font-semibold tablet:text-[28px] tablet:leading-[1.14]">Katalogdan. <span className="text-sf-ink-2">Hozir ko‘pchilik qiziqayotganlar.</span></h2>
        <Link className="inline-flex items-center gap-1 text-[17px] text-sf-link hover:underline" href="/catalog">Barcha mahsulotlar <ChevronRightIcon className="size-4"/></Link>
      </div>
      <Shelf label="Katalogdan">
        {shelf.map(p=><Link key={p.id} href={productHref(p.id)} className="block h-full">
          <Card className="h-full w-[min(72vw,300px)] gap-0 overflow-hidden rounded-[18px] bg-sf-alt py-0 shadow-none ring-0">
            <div className="relative aspect-3/2 bg-(--tile-bg)" style={toneStyle(p.tone,"#f5f5f7")}>
              <ProductVisual image={p.image} name={p.name} category={p.category} sizes="300px" className="absolute inset-0"/>
            </div>
            <div className="flex flex-col gap-1 px-6 pt-5 pb-6">
              <p className={eyebrow}>{p.category}</p>
              <h3 className="mb-1 text-[21px] leading-[1.19] font-semibold tracking-[0.011em]">{p.name}</h3>
              <p className="text-sm">{formatFrom(p.fromPrice)}</p>
              <Availability inStock={p.inStock} className="mt-1"/>
            </div>
          </Card>
        </Link>)}
      </Shelf>
    </section>

    <section id="buyurtma" className="pb-16" aria-labelledby="how-title">
      <div className={cn(wrap,"mb-6")}>
        <h2 id="how-title" className="max-w-[640px] text-2xl leading-[1.17] font-semibold tablet:text-[28px] tablet:leading-[1.14]">Buyurtma berish. <span className="text-sf-ink-2">Uch qadam, ortiqcha shakllarsiz.</span></h2>
      </div>
      <ol className={cn(wrap,"grid gap-4 tablet:grid-cols-3 tablet:gap-5")}>
        {[["Tanlang","Model, rang va xotirani tanlang. Narx tanlovingizga qarab darhol yangilanadi."],
          ["Rasmiylashtiring","Savatga qo‘shing yoki bir bosishda xarid qiling. Ism va raqamingiz yetarli."],
          ["Sotuvchi tasdiqlaydi","Sotuvchi qo‘ng‘iroq qilib, narx va topshirishni kelishadi. Onlayn to‘lov yo‘q."]].map(([title,text],i)=>
          <li key={title} className="sf-reveal flex flex-col gap-2 rounded-[18px] bg-sf-alt p-7">
            <span className="mb-2 inline-flex size-8 items-center justify-center rounded-full bg-sf-ink text-sm font-semibold text-white">{i+1}</span>
            <h3 className="text-[21px] leading-[1.19] font-semibold">{title}</h3>
            <p className="text-sf-ink-2">{text}</p>
          </li>)}
      </ol>
    </section>
  </>;
}
