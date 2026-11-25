import type {Metadata} from "next";
import {Suspense} from "react";
import {CatalogView} from "../../../components/store/catalog-view";
import {wrap} from "../../../components/store/bits";
import {categorySummary} from "../../../lib/server/storefront";
import {pageMeta} from "../../../lib/server/seo";
import {catalogHref,fromSoum} from "../../../lib/storefront";

export const dynamic="force-dynamic";

export async function generateMetadata({searchParams}:{searchParams:Promise<{category?:string;q?:string}>}):Promise<Metadata>{
  const {category,q}=await searchParams;
  if(q?.trim())return pageMeta({title:`“${q.trim().slice(0,60)}” bo‘yicha qidiruv`,description:"Katalogdan qidiruv natijalari. Narxlar so‘mda.",path:"/catalog",index:false});
  if(category){
    try{
      const summary=await categorySummary(category);
      if(summary)return pageMeta({title:`${category}: narxlar va modellar`,path:catalogHref(category),og:{category},
        description:`${category} turkumida ${summary.count} ta model, ${fromSoum(summary.fromPrice)}. Rang va variantni tanlang, buyurtmani saytda bering.`});
    }catch{/* fall back to the catalog page */}
  }
  return pageMeta({title:"Katalog",path:"/catalog",description:"Barcha modellar bir joyda: narxlar so‘mda, ranglar, variantlar va mavjudlik."});
}

export default function CatalogPage(){
  return <div className={wrap+" pb-20"}>
    <Suspense fallback={<h1 className="pt-16 text-5xl font-semibold">Katalog.</h1>}><CatalogView/></Suspense>
  </div>;
}
