import {NextResponse} from "next/server";
import {createHash} from "node:crypto";
import sharp from "sharp";
import {database,configuredStoreId} from "../../../../../lib/server/db";
import {requireStoreRole} from "../../../../../lib/server/auth";
import {privateHeaders} from "../../../../../lib/server/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
const MAX_INPUT=3*1024*1024;
export async function POST(request:Request){
 if(!process.env.APP_ORIGIN||request.headers.get("origin")!==process.env.APP_ORIGIN)return reply({error:"Ruxsat yo‘q"},403);
 try{
 const store=configuredStoreId();const actor=await requireStoreRole(store,["owner","admin"]);if(!actor)return reply({error:"Ruxsat yo‘q"},403);
 if(process.env.CATALOG_ADMIN_ENABLED!=="true")return reply({error:"Katalog tahriri o‘chirilgan"},503);
 const type=request.headers.get("content-type")?.split(";")[0].trim();
 if(!["image/jpeg","image/png","image/webp"].includes(type??""))return reply({error:"JPG, PNG yoki WebP fayl tanlang"},415);
 if(Number(request.headers.get("content-length")??0)>MAX_INPUT)return reply({error:"Fayl 3 MB dan oshmasligi kerak"},413);
 const reader=request.body?.getReader();if(!reader)return reply({error:"Fayl topilmadi"},400);
 const chunks:Uint8Array[]=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>MAX_INPUT){await reader.cancel();return reply({error:"Fayl 3 MB dan oshmasligi kerak"},413);}chunks.push(value);}}catch{return reply({error:"Faylni o‘qib bo‘lmadi"},400);}
 if(!length)return reply({error:"Bo‘sh fayl"},400);
 let bytes:Buffer;
 try{
 const image=sharp(Buffer.concat(chunks),{limitInputPixels:16000000,failOn:"error"});
 const meta=await image.metadata();
 const expected=type==="image/jpeg"?"jpeg":type==="image/png"?"png":"webp";
 if(meta.format!==expected||!meta.width||!meta.height||(meta.pages??1)>1)return reply({error:"Rasm formati mos emas yoki animatsiyali"},415);
 bytes=await image.rotate().resize({width:1600,height:1600,fit:"inside",withoutEnlargement:true}).webp({quality:82}).toBuffer();
 }catch{return reply({error:"Rasmni qayta ishlash imkoni bo‘lmadi"},422);}
 if(bytes.length>1048576)return reply({error:"Rasmni kichikroq hajmda yuklang"},413);
 const hash=createHash("sha256").update(bytes).digest("hex");
 const c=await database().connect();
 try{
 await c.query("BEGIN");
 await c.query("SELECT id FROM stores WHERE id=$1 FOR UPDATE",[store]);
 const existing=await c.query("SELECT id FROM catalog_media WHERE store_id=$1 AND content_sha256=$2",[store,hash]);
 if(existing.rowCount){await c.query("COMMIT");return reply({url:"/api/catalog/media/"+existing.rows[0].id,repeated:true});}
 const usage=await c.query("SELECT COUNT(*)::int AS count,COALESCE(SUM(octet_length(image_bytes)),0)::text AS bytes FROM catalog_media WHERE store_id=$1",[store]);
 if(usage.rows[0].count>=2000||BigInt(usage.rows[0].bytes)+BigInt(bytes.length)>BigInt(256*1024*1024)){await c.query("ROLLBACK");return reply({error:"Rasmlar uchun ajratilgan joy to‘lgan"},409);}
 const r=await c.query("INSERT INTO catalog_media(store_id,content_sha256,image_bytes,created_by) VALUES($1,$2,$3,$4) RETURNING id",[store,hash,bytes,actor.account_id]);
 const id=r.rows[0].id;
 await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'catalog_image_uploaded','catalog_media',$3)",[store,actor.account_id,id]);
 await c.query("COMMIT");return reply({url:"/api/catalog/media/"+id},201);
 }catch{await c.query("ROLLBACK");return reply({error:"Rasm saqlanmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
