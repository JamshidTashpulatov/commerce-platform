import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {cache} from "react";
import {BuyPanel} from "../../../../components/store/buy-panel";
import {pill,wrap} from "../../../../components/store/bits";
import {getProduct} from "../../../../lib/server/storefront";
import {catalogHref,fromSoum,soum} from "../../../../lib/storefront";

export const dynamic="force-dynamic";
const load=cache(async(id:string)=>{try{return await getProduct(id);}catch{return undefined;}});

export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
  const product=await load((await params).id);
  return product?{title:product.name,description:`${product.name}. ${fromSoum(product.fromPrice)}. Buyurtma Telegram orqali.`}:{title:"Mahsulot"};
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
  return <div className={wrap+" pb-16"}>
    <header className="flex flex-col gap-2 pt-8 pb-8 tablet:pt-14 tablet:pb-12">
      <Link className="self-start text-sm text-sf-link hover:underline" href={catalogHref(product.category)}>{product.category}</Link>
      <h1 className="text-[32px] leading-[1.125] font-semibold tracking-[0.004em] tablet:text-5xl tablet:leading-[1.08] tablet:tracking-[-0.003em]">{product.name}</h1>
      <p className="text-[17px] tablet:text-[19px]">{oneprice?soum(product.fromPrice):fromSoum(product.fromPrice)}</p>
    </header>
    <BuyPanel product={product}/>
    {product.description&&<section className="mt-20 max-w-[692px] border-t border-sf-line pt-12" aria-labelledby="about-title">
      <h2 id="about-title" className="mb-4 text-2xl leading-[1.17] font-semibold">Mahsulot haqida.</h2>
      <p className="whitespace-pre-line text-sf-ink-2">{product.description}</p>
    </section>}
  </div>;
}
