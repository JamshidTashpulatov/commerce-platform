import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {cache} from "react";
import {BuyPanel} from "../../../../components/store/buy-panel";
import {CompareToggle} from "../../../../components/store/compare-toggle";
import {pill,wrap} from "../../../../components/store/bits";
import {getProduct} from "../../../../lib/server/storefront";
import {pageMeta,snippet} from "../../../../lib/server/seo";
import {checkoutEnabled} from "../../../../lib/server/checkout";
import {telegramLoginState} from "../../../../lib/server/telegram-login-config";
import {catalogHref,splitDescription} from "../../../../lib/storefront";
import {formatFrom,formatMoney} from "../../../../lib/money";

export const dynamic="force-dynamic";
const load=cache(async(id:string)=>{try{return await getProduct(id);}catch{return undefined;}});

export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
  const product=await load((await params).id);
  if(!product)return {title:"Mahsulot topilmadi",robots:{index:false,follow:true}};
  const oneprice=new Set(product.skus.map(s=>s.price)).size===1;
  const price=oneprice?formatMoney(product.fromPrice):formatFrom(product.fromPrice);
  const body=splitDescription(product.description).body;
  return pageMeta({title:product.name,path:"/products/"+product.id,og:{product:product.id},
    description:snippet(`${product.name}, ${price}. ${body||product.category+" turkumidan."}`)});
}

export default async function ProductPage({params}:{params:Promise<{id:string}>}){
  const product=await load((await params).id);
  if(product===null)notFound();
  if(!product)return <section className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 py-20 text-center">
    <h1 className="text-[40px] leading-[1.1] font-semibold">Mahsulot vaqtincha ochilmadi.</h1>
    <p className="mb-3 text-[19px] text-sf-ink-2">Birozdan keyin sahifani yangilang.</p>
    <Link className={pill()} href="/catalog">Katalogga qaytish</Link>
  </section>;
  const oneprice=new Set(product.skus.map(s=>s.price)).size===1;
  const about=splitDescription(product.description);
  // The option pickers already list the configurations; repeat them only when there are none.
  const config=product.groups.length?[]:about.config;
  return <div className={wrap+" pb-16"}>
    <header className="flex flex-col gap-2 pt-8 pb-8 tablet:pt-14 tablet:pb-12">
      <Link className="self-start text-sm text-sf-link hover:underline" href={catalogHref(product.category)}>{product.category}</Link>
      <h1 className="text-[32px] leading-[1.125] font-semibold tracking-[0.004em] tablet:text-5xl tablet:leading-[1.08] tablet:tracking-[-0.003em]">{product.name}</h1>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="text-[17px] tablet:text-[19px]">{oneprice?formatMoney(product.fromPrice):formatFrom(product.fromPrice)}</p>
        <CompareToggle size="md" item={{id:product.id,name:product.name,category:product.category,image:product.image}}/>
      </div>
    </header>
    <BuyPanel product={product} checkout={{enabled:checkoutEnabled(),telegram:await telegramLoginState("/products/"+product.id)}}/>
    {(about.body||config.length>0)&&<section className="mt-20 max-w-[692px] border-t border-sf-line pt-12" aria-labelledby="about-title">
      <h2 id="about-title" className="mb-4 text-2xl leading-[1.17] font-semibold">Mahsulot haqida.</h2>
      {about.body&&<p className="text-[17px] leading-[1.6] whitespace-pre-line text-sf-ink-2">{about.body}</p>}
      {config.length>0&&<dl className="mt-6 divide-y divide-sf-line/70 border-y border-sf-line/70">
        {config.map(c=><div key={c.name} className="grid gap-1 py-3.5 tablet:grid-cols-[180px_1fr] tablet:gap-6">
          <dt className="text-sm font-semibold">{c.name}</dt><dd className="text-sm text-sf-ink-2">{c.values}</dd>
        </div>)}
      </dl>}
    </section>}
  </div>;
}
