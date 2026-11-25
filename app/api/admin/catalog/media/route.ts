import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../../lib/server/db";
import {requireStoreRole} from "../../../../../lib/server/auth";
import {privateHeaders} from "../../../../../lib/server/http";
import {MEDIA_LIMITS,MediaError,normaliseCatalogImage,saveCatalogImage,type MediaType} from "../../../../../lib/server/catalog-media-store";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
const MAX_INPUT=MEDIA_LIMITS.inputBytes;
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
 try{bytes=await normaliseCatalogImage(Buffer.concat(chunks),type as MediaType);}catch(e){return e instanceof MediaError?reply({error:e.message},e.status):reply({error:"Rasmni qayta ishlash imkoni bo‘lmadi"},422);}
 const c=await database().connect();
 try{
 await c.query("BEGIN");
 await c.query("SELECT id FROM stores WHERE id=$1 FOR UPDATE",[store]);
 const saved=await saveCatalogImage(c,store,actor.account_id,bytes);
 await c.query("COMMIT");
 return saved.repeated?reply({url:saved.url,repeated:true}):reply({url:saved.url},201);
 }catch(e){await c.query("ROLLBACK");return e instanceof MediaError?reply({error:e.message},e.status):reply({error:"Rasm saqlanmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
