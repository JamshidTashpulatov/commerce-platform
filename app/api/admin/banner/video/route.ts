import {NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {database,configuredStoreId} from "../../../../../lib/server/db";
import {requireStoreRole} from "../../../../../lib/server/auth";
import {privateHeaders} from "../../../../../lib/server/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
// Vercel rejects request bodies over about 4.5 MB, so a banner video is uploaded in one piece of at most 4 MB.
const MAX=4*1024*1024;
const tooBig="Video 4 MB dan oshmasligi kerak. Uni qisqartiring yoki siqib qayta saqlang.";

// The file must really be what its type says: MP4 has "ftyp" at byte 4, WebM starts with the EBML header.
function matches(type:string,bytes:Buffer){
  if(type==="video/mp4")return bytes.length>12&&bytes.subarray(4,8).toString("latin1")==="ftyp";
  return bytes.length>4&&bytes.readUInt32BE(0)===0x1a45dfa3;
}

export async function POST(request:Request){
  if(!process.env.APP_ORIGIN||request.headers.get("origin")!==process.env.APP_ORIGIN)return reply({error:"Ruxsat yo‘q"},403);
  try{
    const store=configuredStoreId();const actor=await requireStoreRole(store,["owner","admin"]);if(!actor)return reply({error:"Ruxsat yo‘q"},403);
    if(process.env.CATALOG_ADMIN_ENABLED!=="true")return reply({error:"Katalog tahriri o‘chirilgan"},503);
    const type=request.headers.get("content-type")?.split(";")[0].trim()??"";
    if(type!=="video/mp4"&&type!=="video/webm")return reply({error:"MP4 yoki WebM video tanlang"},415);
    if(Number(request.headers.get("content-length")??0)>MAX)return reply({error:tooBig},413);
    const reader=request.body?.getReader();if(!reader)return reply({error:"Fayl topilmadi"},400);
    const chunks:Uint8Array[]=[];let length=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>MAX){await reader.cancel();return reply({error:tooBig},413);}chunks.push(value);}}catch{return reply({error:"Faylni o‘qib bo‘lmadi"},400);}
    const bytes=Buffer.concat(chunks);
    if(!bytes.length)return reply({error:"Bo‘sh fayl"},400);
    if(!matches(type,bytes))return reply({error:"Fayl tanlangan video formatiga mos emas"},415);
    const hash=createHash("sha256").update(bytes).digest("hex");
    const c=await database().connect();
    try{
      await c.query("BEGIN");
      await c.query("SELECT id FROM stores WHERE id=$1 FOR UPDATE",[store]);
      const existing=await c.query("SELECT id FROM banner_videos WHERE store_id=$1 AND content_sha256=$2",[store,hash]);
      if(existing.rowCount){await c.query("COMMIT");return reply({url:"/api/banner/video/"+existing.rows[0].id,repeated:true});}
      const usage=await c.query("SELECT COUNT(*)::int AS count,COALESCE(SUM(octet_length(video_bytes)),0)::text AS bytes FROM banner_videos WHERE store_id=$1",[store]);
      if(usage.rows[0].count>=30||BigInt(usage.rows[0].bytes)+BigInt(bytes.length)>BigInt(96*1024*1024)){await c.query("ROLLBACK");return reply({error:"Videolar uchun ajratilgan joy to‘lgan"},409);}
      const r=await c.query("INSERT INTO banner_videos(store_id,content_type,content_sha256,video_bytes,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id",[store,type,hash,bytes,actor.account_id]);
      const id=r.rows[0].id;
      await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'banner_video_uploaded','banner_video',$3)",[store,actor.account_id,id]);
      await c.query("COMMIT");return reply({url:"/api/banner/video/"+id},201);
    }catch{await c.query("ROLLBACK");return reply({error:"Video saqlanmadi"},503);}finally{c.release();}
  }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
