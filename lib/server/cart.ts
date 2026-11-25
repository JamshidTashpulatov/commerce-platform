import "server-only";
import {variantImage,type OptionGroup,type OptionSelection} from "../catalog-options";
import {approvedImageUrl} from "./catalog-media";
import {isUuid} from "./http";
import type {Pool,PoolClient} from "pg";

export type QuotedLine={variantId:string;productId:string;name:string;category:string;options:string;image:string|null;
  unitPrice:string;quantity:number;available:boolean;inStock:boolean};
const safe=(url:string|null)=>url&&approvedImageUrl(url)?url:null;

/** Parse {variantId,quantity}[] from an untrusted body. Duplicate variants are rejected, not merged. */
export function parseLines(raw:unknown,maxLines=20,maxQty=10){
  if(!Array.isArray(raw)||raw.length<1||raw.length>maxLines)return null;
  const seen=new Set<string>();const lines:{variantId:string;quantity:number;expectedPrice:string|null}[]=[];
  for(const l of raw){
    if(!l||typeof l!=="object")return null;
    const {variantId,quantity,expectedPrice}=l as Record<string,unknown>;
    if(!isUuid(variantId)||typeof quantity!=="number"||!Number.isSafeInteger(quantity)||quantity<1||quantity>maxQty)return null;
    if(expectedPrice!==undefined&&(typeof expectedPrice!=="string"||!/^\d{1,15}$/.test(expectedPrice)))return null;
    const id=variantId.toLowerCase();
    if(seen.has(id))return null;
    seen.add(id);lines.push({variantId:id,quantity,expectedPrice:(expectedPrice as string|undefined)??null});
  }
  return lines;
}

/**
 * Current server-side truth for the given variants: published product, active
 * variant, price and availability. Variants that are gone come back as unavailable.
 */
export async function quoteLines(db:Pool|PoolClient,storeId:string,lines:{variantId:string;quantity:number}[],lock=false):Promise<QuotedLine[]>{
  const {rows}=await db.query(
    `SELECT v.id,v.product_id,p.name,p.category,p.image_url,p.option_groups,v.option_values,v.image_url AS variant_image,
       v.color,v.storage_label,v.price_uzs::text AS price,v.quantity>0 AS in_stock,(v.active AND p.published) AS available
     FROM variants v JOIN products p ON p.store_id=v.store_id AND p.id=v.product_id
     WHERE v.store_id=$1 AND v.id=ANY($2::uuid[])${lock?" FOR SHARE OF v":""}`,
    [storeId,lines.map(l=>l.variantId)]);
  const byId=new Map(rows.map(r=>[r.id as string,r]));
  return lines.map(l=>{
    const r=byId.get(l.variantId);
    if(!r)return {variantId:l.variantId,productId:"",name:"",category:"",options:"",image:null,unitPrice:"0",quantity:l.quantity,available:false,inStock:false};
    const groups=r.option_groups as OptionGroup[];
    const selection=r.option_values as OptionSelection;
    const options=groups.length?groups.map(g=>selection[g.name]).filter(Boolean).join(", "):[r.color,r.storage_label].filter(v=>v&&v!=="Standart").join(", ");
    const image=variantImage(groups.map(g=>({...g,values:g.values.map(v=>({...v,imageUrl:safe(v.imageUrl)}))})),selection,safe(r.variant_image),safe(r.image_url));
    return {variantId:l.variantId,productId:r.product_id,name:r.name,category:r.category,options,image,unitPrice:r.price,
      quantity:l.quantity,available:r.available,inStock:r.in_stock};
  });
}
