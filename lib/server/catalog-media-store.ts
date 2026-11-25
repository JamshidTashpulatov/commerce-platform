// Normalise and store a catalog image. Shared by the admin upload route and
// scripts/catalog-images/apply.mjs, so every stored image goes through the same
// checks. No Next.js imports: the script loads this file with plain Node.
import {createHash} from "node:crypto";
import sharp from "sharp";
import type {PoolClient} from "pg";

export const MEDIA_LIMITS={inputBytes:3*1024*1024,outputBytes:1048576,count:2000,totalBytes:256*1024*1024,pixels:16000000,maxSide:1600};
export type MediaType="image/jpeg"|"image/png"|"image/webp";
// No constructor parameter properties: Node's type stripping cannot run them.
export class MediaError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status;}}

/** Decode, orient, fit within 1600px and re-encode to WebP without metadata. */
export async function normaliseCatalogImage(input:Buffer,type:MediaType):Promise<Buffer>{
  let bytes:Buffer;
  try{
    const image=sharp(input,{limitInputPixels:MEDIA_LIMITS.pixels,failOn:"error"});
    const meta=await image.metadata();
    const expected=type==="image/jpeg"?"jpeg":type==="image/png"?"png":"webp";
    if(meta.format!==expected||!meta.width||!meta.height||(meta.pages??1)>1)throw new MediaError(415,"Rasm formati mos emas yoki animatsiyali");
    bytes=await image.rotate().resize({width:MEDIA_LIMITS.maxSide,height:MEDIA_LIMITS.maxSide,fit:"inside",withoutEnlargement:true}).webp({quality:82}).toBuffer();
  }catch(e){if(e instanceof MediaError)throw e;throw new MediaError(422,"Rasmni qayta ishlash imkoni bo‘lmadi");}
  if(bytes.length>MEDIA_LIMITS.outputBytes)throw new MediaError(413,"Rasmni kichikroq hajmda yuklang");
  return bytes;
}

/**
 * Store normalised bytes for a store inside the caller's transaction, which
 * must already hold the store row lock. Identical images are stored once.
 */
export async function saveCatalogImage(c:PoolClient,store:string,actor:string,bytes:Buffer):Promise<{url:string;repeated:boolean}>{
  const hash=createHash("sha256").update(bytes).digest("hex");
  const existing=await c.query("SELECT id FROM catalog_media WHERE store_id=$1 AND content_sha256=$2",[store,hash]);
  if(existing.rowCount)return {url:"/api/catalog/media/"+existing.rows[0].id,repeated:true};
  const usage=await c.query("SELECT COUNT(*)::int AS count,COALESCE(SUM(octet_length(image_bytes)),0)::text AS bytes FROM catalog_media WHERE store_id=$1",[store]);
  if(usage.rows[0].count>=MEDIA_LIMITS.count||BigInt(usage.rows[0].bytes)+BigInt(bytes.length)>BigInt(MEDIA_LIMITS.totalBytes))throw new MediaError(409,"Rasmlar uchun ajratilgan joy to‘lgan");
  const r=await c.query("INSERT INTO catalog_media(store_id,content_sha256,image_bytes,created_by) VALUES($1,$2,$3,$4) RETURNING id",[store,hash,bytes,actor]);
  const id=r.rows[0].id;
  await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'catalog_image_uploaded','catalog_media',$3)",[store,actor,id]);
  return {url:"/api/catalog/media/"+id,repeated:false};
}
