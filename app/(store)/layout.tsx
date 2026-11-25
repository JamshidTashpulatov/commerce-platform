import type {Metadata} from "next";
import type {ReactNode} from "react";
import {Suspense} from "react";
import {Inter} from "next/font/google";
import {StoreNav} from "../../components/store/store-nav";
import {StoreFooter} from "../../components/store/store-footer";
import {CompareTray} from "../../components/store/compare-tray";
import {CartSheet} from "../../components/store/cart-sheet";
import {listCategories} from "../../lib/server/storefront";
import {STORE_NAME} from "../../lib/storefront";

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
  // data-ui="shadcn" switches the legacy globals.css rules off for these pages.
  return <div data-ui="shadcn" className={"sf flex min-h-dvh flex-col bg-white font-sf text-[17px] leading-[1.47] tracking-[-0.022em] text-sf-ink antialiased "+inter.variable}>
    <a className="absolute -top-16 left-3 z-50 rounded-lg bg-sf-ink px-3.5 py-2 text-sm text-white focus:top-2" href="#sf-main">Asosiy qismga o‘tish</a>
    <Suspense fallback={<div className="sticky top-0 z-40 h-12 bg-[rgba(250,250,252,0.8)] tablet:h-11"/>}><StoreNav categories={categories}/></Suspense>
    <main id="sf-main" className="min-w-0 flex-1">{children}</main>
    <StoreFooter categories={categories}/>
    <Suspense><CompareTray/><CartSheet/></Suspense>
  </div>;
}
