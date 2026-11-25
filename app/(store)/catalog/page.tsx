import type {Metadata} from "next";
import {Suspense} from "react";
import {CatalogView} from "../../../components/store/catalog-view";
import {wrap} from "../../../components/store/bits";
import {CatalogStrip,type StripItem} from "../../../components/store/catalog-strip";
import {categoryFamilies,categoryLeads,categorySummary} from "../../../lib/server/storefront";
import {pageMeta} from "../../../lib/server/seo";
import {catalogHref} from "../../../lib/storefront";
import {formatFrom} from "../../../lib/money";

export const dynamic="force-dynamic";

export async function generateMetadata({searchParams}:{searchParams:Promise<{category?:string;q?:string}>}):Promise<Metadata>{
  const {category,q}=await searchParams;
  if(q?.trim())return pageMeta({title:`“${q.trim().slice(0,60)}” bo‘yicha qidiruv`,description:"Katalogdan qidiruv natijalari. Narxlar dollarda.",path:"/catalog",index:false});
  if(category){
    try{
      const summary=await categorySummary(category);
      if(summary)return pageMeta({title:`${category}: narxlar va modellar`,path:catalogHref(category),og:{category},
        description:`${category} turkumida ${summary.count} ta model, ${formatFrom(summary.fromPrice)}. Rang va variantni tanlang, buyurtmani saytda bering.`});
    }catch{/* fall back to the catalog page */}
  }
  return pageMeta({title:"Katalog",path:"/catalog",description:"Barcha modellar bir joyda: narxlar dollarda, ranglar, variantlar va mavjudlik."});
}

export default async function CatalogPage({searchParams}:{searchParams:Promise<{category?:string;model?:string;sort?:string;q?:string}>}){
  const {category,model,sort,q}=await searchParams;
  // Model links keep the search and sort, and a second click on the chosen family clears it.
  const familyHref=(family:string|null)=>{
    const url=new URLSearchParams({category:category!});
    if(family)url.set("model",family);
    if(q)url.set("q",q);
    if(sort)url.set("sort",sort);
    return "/catalog?"+url;
  };
  // A failed lookup only hides the strip; the catalog itself loads on the client.
  const items:StripItem[]=typeof category==="string"&&category
    ?(await categoryFamilies(category).catch(()=>[])).map(f=>({key:f.family,name:f.family,image:f.image,category,
        selected:f.family===model,href:familyHref(f.family===model?null:f.family)}))
    :(await categoryLeads().catch(()=>[])).map(c=>({key:c.category,href:catalogHref(c.category),name:c.category,image:c.image,category:c.category}));
  return <div className={wrap+" pb-20"}>
    <Suspense fallback={<h1 className="pt-16 text-5xl font-semibold">Katalog.</h1>}>
      <CatalogView strip={items.length>1?<CatalogStrip label={category?category+" modellari":"Turkumlar"} items={items}/>:undefined}/>
    </Suspense>
  </div>;
}
