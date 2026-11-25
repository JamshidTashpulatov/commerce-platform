import Link from "next/link";
import type {CSSProperties} from "react";
import {ProductVisual} from "../../components/store/product-visual";
import {Shelf} from "../../components/store/shelf";
import {Availability,Chevron} from "../../components/store/bits";
import {listProducts,sortCategories,type StoreProduct,type Tone} from "../../lib/server/storefront";
import {TELEGRAM_URL,catalogHref,fromSoum,productHref} from "../../lib/storefront";

export const dynamic="force-dynamic";

const toneStyle=(tone:Tone|null)=>(tone?{"--tile-bg":tone.background}:{}) as CSSProperties;
const toneClass=(tone:Tone|null)=>tone?.dark?" is-dark":"";

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

  if(!hero)return <section className="sf-empty-page">
    <h1>{failed?"Katalog vaqtincha ochilmadi.":"Mahsulotlar tez orada."}</h1>
    <p>{failed?"Birozdan keyin sahifani yangilang yoki Telegram orqali yozing.":"Hozircha e’lon qilingan mahsulot yo‘q. Savollar bo‘lsa, Telegram orqali yozing."}</p>
    <a className="sf-btn" href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">Telegram’da yozish</a>
  </section>;

  return <>
    <section className={"sf-hero"+toneClass(hero.product.tone)} style={toneStyle(hero.product.tone)} aria-labelledby="hero-title">
      <div className="sf-hero-copy">
        <p className="sf-eyebrow">{hero.category}</p>
        <h1 id="hero-title">{hero.product.name}</h1>
        <p className="sf-hero-sub">{fromSoum(hero.product.fromPrice)}. Buyurtma Telegram orqali.</p>
        <div className="sf-ctas">
          <Link className="sf-btn" href={productHref(hero.product.id)}>Batafsil</Link>
          <Link className="sf-btn sf-btn-ghost" href={catalogHref(hero.category)}>Barcha {hero.category}</Link>
        </div>
      </div>
      <Link href={productHref(hero.product.id)} className="sf-hero-media" tabIndex={-1} aria-hidden="true">
        <ProductVisual image={hero.product.image} name={hero.product.name} category={hero.category} priority/>
      </Link>
    </section>

    {tiles.length>0&&<section className="sf-tiles" aria-label="Turkumlar bo‘yicha tanlov">
      {tiles.map(({category,count,product},i)=><article key={category}
        className={"sf-tile sf-reveal"+toneClass(product.tone)+(tiles.length%2&&i===tiles.length-1?" is-wide":"")} style={toneStyle(product.tone)}>
        <div className="sf-tile-copy">
          <p className="sf-eyebrow">{category}</p>
          <h2>{product.name}</h2>
          <p>{fromSoum(product.fromPrice)}{count>1?`. Turkumda ${count} ta model.`:"."}</p>
          <div className="sf-ctas">
            <Link className="sf-btn" href={productHref(product.id)} aria-label={product.name+" haqida batafsil"}>Batafsil</Link>
            <Link className="sf-btn sf-btn-ghost" href={catalogHref(category)} aria-label={"Barcha "+category+" mahsulotlari"}>Barchasi</Link>
          </div>
        </div>
        <Link href={productHref(product.id)} className="sf-tile-media" tabIndex={-1} aria-hidden="true">
          <ProductVisual image={product.image} name={product.name} category={category}/>
        </Link>
      </article>)}
    </section>}

    <section className="sf-section" aria-labelledby="shelf-title">
      <div className="sf-section-head">
        <h2 id="shelf-title">Katalogdan. <span>Hozir ko‘pchilik qiziqayotganlar.</span></h2>
        <Link className="sf-link" href="/catalog">Barcha mahsulotlar <Chevron/></Link>
      </div>
      <Shelf label="Katalogdan">
        {shelf.map(p=><Link key={p.id} href={productHref(p.id)} className="sf-shelf-card">
          <div className="sf-shelf-media" style={toneStyle(p.tone)}><ProductVisual image={p.image} name={p.name} category={p.category}/></div>
          <div className="sf-shelf-copy">
            <p className="sf-eyebrow">{p.category}</p>
            <h3>{p.name}</h3>
            <p className="sf-price">{fromSoum(p.fromPrice)}</p>
            <Availability inStock={p.inStock}/>
          </div>
        </Link>)}
      </Shelf>
    </section>

    <section className="sf-section" id="buyurtma" aria-labelledby="how-title">
      <div className="sf-section-head">
        <h2 id="how-title">Buyurtma berish. <span>Uch qadamda, ortiqcha shaklsiz.</span></h2>
      </div>
      <ol className="sf-steps">
        <li className="sf-reveal"><span className="sf-step-n">1</span><h3>Tanlang</h3><p>Katalogda model, rang va xotirani tanlang. Narx tanlovga qarab darhol yangilanadi.</p></li>
        <li className="sf-reveal"><span className="sf-step-n">2</span><h3>Telegram’da yozing</h3><p>Mahsulot sahifasidagi tugma do‘konning Telegram botini ochadi. Tanlovingizni nusxa olib yuborishingiz mumkin.</p></li>
        <li className="sf-reveal"><span className="sf-step-n">3</span><h3>Sotuvchi tasdiqlaydi</h3><p>Sotuvchi narx, mavjudlik va topshirish shartlarini siz bilan kelishadi. Onlayn to‘lov yo‘q.</p></li>
      </ol>
    </section>
  </>;
}

