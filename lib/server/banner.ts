import "server-only";
import {database,configuredStoreId} from "./db";
import {approvedImageUrl} from "./catalog-media";

export type Banner={eyebrow:string;title:string;subtitle:string;imageUrl:string|null;videoUrl:string|null;
  primaryLabel:string;primaryHref:string;secondaryLabel:string;secondaryHref:string;published:boolean};
export const bannerVideoId=(value:string)=>/^\/api\/banner\/video\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.exec(value)?.[1]??null;
export const BANNER_LIMITS={eyebrow:40,title:80,subtitle:200,label:30,href:300} as const;

/** A link a banner button may point to: a path on this site, or an https address. */
export function validBannerHref(value:string):boolean{
  if(!value||value.length>BANNER_LIMITS.href||/\s/.test(value))return false;
  if(value.startsWith("/"))return !value.startsWith("//")&&!value.startsWith("/\\");
  try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password;}catch{return false;}
}

const text=(v:unknown,max:number,required=false)=>typeof v==="string"&&v.trim().length<=max&&(!required||v.trim().length>0);

/** Parses and validates a banner from an admin request. Returns an error message for the editor, or the banner. */
export function parseBanner(b:Record<string,unknown>):Banner|string{
  if(!text(b.title,BANNER_LIMITS.title,true))return "Sarlavhani kiriting (80 belgigacha)";
  if(!text(b.eyebrow,BANNER_LIMITS.eyebrow)||!text(b.subtitle,BANNER_LIMITS.subtitle))return "Matn uzunligini tekshiring";
  if(b.imageUrl!==null&&(typeof b.imageUrl!=="string"||!approvedImageUrl(b.imageUrl)))return "Rasm tasdiqlangan manbadan bo‘lishi kerak";
  if(b.videoUrl!==null&&(typeof b.videoUrl!=="string"||!bannerVideoId(b.videoUrl)))return "Video shu yerda yuklangan bo‘lishi kerak";
  if(typeof b.published!=="boolean")return "E’lon holatini tanlang";
  const buttons:[string,string][]=[];
  for(const [label,href] of [[b.primaryLabel,b.primaryHref],[b.secondaryLabel,b.secondaryHref]]){
    if(!text(label,BANNER_LIMITS.label)||typeof href!=="string")return "Tugma matni va havolasini tekshiring";
    const l=(label as string).trim(),h=href.trim();
    if(!l!==!h)return "Tugmaning matni ham, havolasi ham bo‘lishi kerak";
    if(h&&!validBannerHref(h))return "Havola “/” bilan boshlanadigan sayt sahifasi yoki https manzil bo‘lishi kerak";
    buttons.push([l,h]);
  }
  return {eyebrow:String(b.eyebrow).trim(),title:String(b.title).trim(),subtitle:String(b.subtitle).trim(),imageUrl:b.imageUrl as string|null,videoUrl:b.videoUrl as string|null,
    primaryLabel:buttons[0][0],primaryHref:buttons[0][1],secondaryLabel:buttons[1][0],secondaryHref:buttons[1][1],published:b.published as boolean};
}

export const bannerColumns="eyebrow,title,subtitle,image_url,video_url,primary_label,primary_href,secondary_label,secondary_href,published";
export const fromRow=(r:Record<string,unknown>):Banner=>({eyebrow:r.eyebrow as string,title:r.title as string,subtitle:r.subtitle as string,
  imageUrl:r.image_url as string|null,videoUrl:r.video_url as string|null,primaryLabel:r.primary_label as string,primaryHref:r.primary_href as string,
  secondaryLabel:r.secondary_label as string,secondaryHref:r.secondary_href as string,published:r.published as boolean});

/** The published home page banner, or null. A missing table or a failed query means no banner. */
export async function publishedBanner():Promise<Banner|null>{
  try{
    const r=await database().query(`SELECT ${bannerColumns} FROM store_banners WHERE store_id=$1 AND published`,[configuredStoreId()]);
    if(!r.rowCount)return null;
    const banner=fromRow(r.rows[0]);
    return {...banner,imageUrl:banner.imageUrl&&approvedImageUrl(banner.imageUrl)?banner.imageUrl:null};
  }catch{return null;}
}
