import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {cache} from "react";
import {BuyPanel} from "../../../../components/store/buy-panel";
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
  if(!product)return <section className="sf-empty-page">
    <h1>Mahsulot vaqtincha ochilmadi.</h1>
    <p>Birozdan keyin sahifani yangilang.</p>
    <Link className="sf-btn" href="/catalog">Katalogga qaytish</Link>
  </section>;
  return <div className="sf-wrap sf-product">
    <header className="sf-product-head">
      <Link className="sf-eyebrow sf-crumb" href={catalogHref(product.category)}>{product.category}</Link>
      <h1>{product.name}</h1>
      <p>{new Set(product.skus.map(s=>s.price)).size>1?fromSoum(product.fromPrice):soum(product.fromPrice)}</p>
    </header>
    <BuyPanel product={product}/>
    {product.description&&<section className="sf-about" aria-labelledby="about-title">
      <h2 id="about-title">Mahsulot haqida.</h2>
      <p>{product.description}</p>
    </section>}
  </div>;
}
