import "server-only";
import sharp from "sharp";
import {variantImage,type OptionGroup,type OptionSelection} from "../catalog-options";
import {approvedImageUrl,localMediaId} from "./catalog-media";
import {database,configuredStoreId} from "./db";
import {isUuid} from "./http";
import {sortCategories} from "../storefront";
export {sortCategories};

// Read-only queries for the public storefront. Only published products with
// at least one active variant are visible, matching /api/catalog.

export type Tone={background:string;dark:boolean};
export type StoreProduct={
  id:string;name:string;category:string;description:string;
  image:string|null;tone:Tone|null;fromPrice:string;inStock:boolean;variants:number;
};
export type StoreVariant={id:string;label:string;price:string;inStock:boolean;image:string|null;options:OptionSelection};
export type StoreProductDetail=StoreProduct&{groups:OptionGroup[];skus:StoreVariant[];tones:Record<string,Tone>};

const safe=(url:string|null)=>url&&approvedImageUrl(url)?url:null;
function publicGroups(raw:OptionGroup[]):OptionGroup[]{
  return raw.map(g=>({...g,values:g.values.map(v=>({...v,imageUrl:safe(v.imageUrl)}))}));
}

export async function listCategories():Promise<string[]>{
  try{
    const r=await database().query(`SELECT DISTINCT p.category FROM products p WHERE p.store_id=$1 AND p.published
      AND EXISTS (SELECT 1 FROM variants v WHERE v.store_id=p.store_id AND v.product_id=p.id AND v.active)`,[configuredStoreId()]);
    return sortCategories(r.rows.map(x=>x.category as string));
  }catch{return [];}
}

/** All visible products with their lowest price. Capped for the home page. */
export async function listProducts(limit=200):Promise<StoreProduct[]>{
  const r=await database().query(
    `SELECT p.id,p.name,p.category,p.description,p.image_url,p.option_groups,
       min(v.price_uzs)::text AS from_price,bool_or(v.quantity>0) AS in_stock,count(*)::int AS variants,
       (array_agg(v.image_url ORDER BY v.price_uzs,v.id))[1] AS variant_image,
       (array_agg(v.option_values ORDER BY v.price_uzs,v.id))[1] AS first_options
     FROM products p JOIN variants v ON v.store_id=p.store_id AND v.product_id=p.id AND v.active
     WHERE p.store_id=$1 AND p.published
     GROUP BY p.id ORDER BY p.name,p.id LIMIT $2`,[configuredStoreId(),limit]);
  return Promise.all(r.rows.map(async row=>{
    const groups=publicGroups(row.option_groups as OptionGroup[]);
    const image=variantImage(groups,row.first_options as OptionSelection,safe(row.variant_image),safe(row.image_url));
    return {id:row.id,name:row.name,category:row.category,description:row.description,image,tone:await imageTone(image),
      fromPrice:row.from_price,inStock:row.in_stock,variants:row.variants};
  }));
}

export async function getProduct(id:string):Promise<StoreProductDetail|null>{
  if(!isUuid(id))return null;
  const r=await database().query(
    `SELECT p.id,p.name,p.category,p.description,p.image_url,p.option_groups,v.id AS variant_id,v.color,v.storage_label,
       v.option_values,v.image_url AS variant_image,v.price_uzs::text AS price,v.quantity>0 AS in_stock
     FROM products p JOIN variants v ON v.store_id=p.store_id AND v.product_id=p.id AND v.active
     WHERE p.store_id=$1 AND p.id=$2 AND p.published ORDER BY v.price_uzs,v.color,v.id LIMIT 1000`,[configuredStoreId(),id]);
  if(!r.rowCount)return null;
  const head=r.rows[0];
  const groups=publicGroups(head.option_groups as OptionGroup[]);
  const productImage=safe(head.image_url);
  const variants:StoreVariant[]=r.rows.map(row=>({
    id:row.variant_id,
    label:[row.color,row.storage_label].filter(Boolean).join(" · "),
    price:row.price,inStock:row.in_stock,options:row.option_values as OptionSelection,
    image:variantImage(groups,row.option_values as OptionSelection,safe(row.variant_image),productImage),
  }));
  const images=new Set<string>();
  for(const v of variants)if(v.image)images.add(v.image);
  for(const g of groups)for(const v of g.values)if(v.imageUrl)images.add(v.imageUrl);
  if(productImage)images.add(productImage);
  const tones:Record<string,Tone>={};
  await Promise.all([...images].map(async url=>{const t=await imageTone(url);if(t)tones[url]=t;}));
  const cover=variants.find(v=>v.inStock)?.image??variants[0].image??productImage;
  return {id:head.id,name:head.name,category:head.category,description:head.description,image:cover,tone:cover?tones[cover]??null:null,
    fromPrice:variants.reduce((m,v)=>BigInt(v.price)<BigInt(m)?v.price:m,variants[0].price),
    inStock:variants.some(v=>v.inStock),variants:variants.length,groups,skus:variants,tones};
}

// The background colour along an image's edges, so a tile can extend the
// photo seamlessly. Media content never changes for an id, so cache forever.
const tones=new Map<string,Tone|null>();
export async function imageTone(url:string|null):Promise<Tone|null>{
  const id=url?localMediaId(url):null;
  if(!id)return null;
  if(tones.has(id))return tones.get(id)!;
  let tone:Tone|null=null;
  try{
    const r=await database().query("SELECT image_bytes FROM catalog_media WHERE store_id=$1 AND id=$2",[configuredStoreId(),id]);
    if(r.rowCount){
      const {data,info}=await sharp(r.rows[0].image_bytes as Buffer).resize(32,18,{fit:"fill"}).removeAlpha().raw().toBuffer({resolveWithObject:true});
      // Sample the top edge and the upper half of both sides: that is where the
      // photo meets the tile. A busy edge has no single colour, so skip it.
      const px:number[][]=[];
      for(let y=0;y<info.height/2;y++)for(let x=0;x<info.width;x++){
        if(y>0&&x>0&&x<info.width-1)continue;
        const i=(y*info.width+x)*3;px.push([data[i],data[i+1],data[i+2]]);
      }
      const [red,green,blue]=[0,1,2].map(c=>Math.round(px.reduce((s,p)=>s+p[c],0)/px.length));
      const spread=Math.sqrt(px.reduce((s,p)=>s+(p[0]-red)**2+(p[1]-green)**2+(p[2]-blue)**2,0)/px.length);
      if(spread<=24)tone={background:`rgb(${red},${green},${blue})`,dark:(0.2126*red+0.7152*green+0.0722*blue)<140};
    }
  }catch{tone=null;}
  if(tones.size>2000)tones.clear();
  tones.set(id,tone);
  return tone;
}

/** Model count and lowest price of a published category, for metadata. One cheap query. */
export async function categorySummary(category:string):Promise<{count:number;fromPrice:string}|null>{
  const r=await database().query(
    `SELECT count(DISTINCT p.id)::int AS count,min(v.price_uzs)::text AS from_price
     FROM products p JOIN variants v ON v.store_id=p.store_id AND v.product_id=p.id AND v.active
     WHERE p.store_id=$1 AND p.published AND p.category=$2`,[configuredStoreId(),category]);
  return r.rows[0]?.count?{count:r.rows[0].count,fromPrice:r.rows[0].from_price}:null;
}

export type CategoryModel={id:string;name:string;image:string|null};
/** The models of one published category for the strip above its catalog page, most expensive first. */
export async function categoryModels(category:string,limit=24):Promise<CategoryModel[]>{
  const r=await database().query(
    `SELECT p.id,p.name,p.image_url,p.option_groups,
       (array_agg(v.image_url ORDER BY v.price_uzs,v.id))[1] AS variant_image,
       (array_agg(v.option_values ORDER BY v.price_uzs,v.id))[1] AS first_options
     FROM products p JOIN variants v ON v.store_id=p.store_id AND v.product_id=p.id AND v.active
     WHERE p.store_id=$1 AND p.published AND p.category=$2
     GROUP BY p.id ORDER BY max(v.price_uzs) DESC,p.name,p.id LIMIT $3`,[configuredStoreId(),category,limit]);
  return r.rows.map(row=>({id:row.id,name:row.name,
    image:variantImage(publicGroups(row.option_groups as OptionGroup[]),row.first_options as OptionSelection,safe(row.variant_image),safe(row.image_url))}));
}
