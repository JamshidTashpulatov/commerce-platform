import type {Metadata} from "next";
import type {ReactNode} from "react";
import {Suspense} from "react";
import {Inter} from "next/font/google";
import {StoreNav} from "../../components/store/store-nav";
import {StoreFooter} from "../../components/store/store-footer";
import {listCategories} from "../../lib/server/storefront";
import {STORE_NAME} from "../../lib/storefront";
import "./store.css";

// Inter is only the fallback: Apple devices render the system font first.
const inter=Inter({subsets:["latin","cyrillic"],variable:"--sf-inter",display:"swap"});

// Categories come from the live catalog, so never prerender at build time.
export const dynamic="force-dynamic";

export const metadata:Metadata={
  title:{default:STORE_NAME+". Apple texnikasi do‘koni",template:"%s. "+STORE_NAME},
  description:"iPhone, iPad, Mac, Apple Watch, AirPods va aksessuarlar. Narxlar so‘mda, buyurtma Telegram orqali.",
};

export default async function StoreLayout({children}:{children:ReactNode}){
  const categories=await listCategories();
  return <div className={"sf "+inter.variable}>
    <a className="sf-skip" href="#sf-main">Asosiy qismga o‘tish</a>
    <Suspense fallback={<div className="sf-nav sf-nav-placeholder"/>}><StoreNav categories={categories}/></Suspense>
    <main id="sf-main" className="sf-main">{children}</main>
    <StoreFooter categories={categories}/>
  </div>;
}
