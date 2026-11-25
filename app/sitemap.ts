import type {MetadataRoute} from "next";
import {siteOrigin} from "@/lib/server/site";
import {listProducts} from "@/lib/server/storefront";
import {catalogHref,productHref,sortCategories} from "@/lib/storefront";

export const dynamic="force-dynamic";

// Published products and their categories, read from the live catalog.
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
  const origin=siteOrigin();
  const base:MetadataRoute.Sitemap=[{url:origin+"/",changeFrequency:"daily",priority:1},{url:origin+"/catalog",changeFrequency:"daily",priority:0.8}];
  try{
    const products=await listProducts();
    const categories=sortCategories([...new Set(products.map(p=>p.category))]);
    return [...base,
      ...categories.map(c=>({url:origin+catalogHref(c),changeFrequency:"weekly" as const,priority:0.7})),
      ...products.map(p=>({url:origin+productHref(p.id),changeFrequency:"weekly" as const,priority:0.6}))];
  }catch{return base;}
}
