import "server-only";
import type {Metadata} from "next";
import {STORE_NAME} from "../storefront";

export type OgTarget={product:string}|{category:string}|null;
/** Canonical URL, Open Graph and Twitter tags for a storefront page, with its dynamic OG image. */
export function pageMeta({title,description,path,og=null,index=true,absoluteTitle=false}:{
  title:string;description:string;path:string;og?:OgTarget;index?:boolean;absoluteTitle?:boolean;
}):Metadata{
  const query=og&&"product" in og?"?p="+encodeURIComponent(og.product):og&&"category" in og?"?c="+encodeURIComponent(og.category):"";
  const image={url:"/og"+query,width:1200,height:630,alt:title};
  return {
    title:absoluteTitle?{absolute:title}:title,description,
    alternates:{canonical:path},
    robots:index?{index:true,follow:true}:{index:false,follow:true},
    // A page-level openGraph replaces the root one, so repeat site name and locale here.
    openGraph:{title,description,url:path,type:"website",siteName:STORE_NAME,locale:"uz_UZ",images:[image]},
    twitter:{card:"summary_large_image",title,description,images:[image.url]},
  };
}
/** First sentences of a description, trimmed to what search results show. */
export function snippet(text:string,max=155){
  const t=text.replace(/\s+/g," ").trim();
  if(t.length<=max)return t;
  const cut=t.slice(0,max-1);
  return cut.slice(0,Math.max(cut.lastIndexOf(". ")+1,cut.lastIndexOf(" "))).trim()+"…";
}
