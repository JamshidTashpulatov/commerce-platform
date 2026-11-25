import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../../lib/server/db";
import {requireStoreRole} from "../../../../../lib/server/auth";
import {isUuid,privateHeaders} from "../../../../../lib/server/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const missing=()=>NextResponse.json({error:"Video topilmadi"},{status:404,headers:privateHeaders});

// Serves a banner video: to admins always, to everyone else only while a published banner uses it.
// Byte ranges are supported, since Safari plays video only through range requests.
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;if(!isUuid(id))return missing();
    const store=configuredStoreId();const path="/api/banner/video/"+id.toLowerCase();
    const admin=!!await requireStoreRole(store,["owner","admin"]);
    const db=database();
    const head=await db.query(`SELECT content_type,octet_length(video_bytes) AS size FROM banner_videos v WHERE v.store_id=$1 AND v.id=$2
      AND ($3::boolean OR EXISTS(SELECT 1 FROM store_banners b WHERE b.store_id=v.store_id AND b.published AND b.video_url=$4))`,[store,id,admin,path]);
    if(!head.rowCount)return missing();
    const size=Number(head.rows[0].size);
    const headers:Record<string,string>={"Content-Type":head.rows[0].content_type,"Accept-Ranges":"bytes","X-Content-Type-Options":"nosniff",
      "Content-Security-Policy":"default-src 'none'","Cache-Control":"private, max-age=600"};
    const range=/^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range")??"");
    let start=0,end=size-1;
    if(range&&(range[1]||range[2])){
      if(range[1]){start=Number(range[1]);if(range[2])end=Math.min(size-1,Number(range[2]));}
      else start=Math.max(0,size-Number(range[2]));
      if(start>end||start>=size)return new Response(null,{status:416,headers:{...headers,"Content-Range":`bytes */${size}`}});
    }
    const body=await db.query("SELECT substring(video_bytes FROM $3 FOR $4) AS part FROM banner_videos WHERE store_id=$1 AND id=$2",[store,id,start+1,end-start+1]);
    const part=new Uint8Array(body.rows[0].part as Buffer);
    return new Response(part,{status:range&&(range[1]||range[2])?206:200,headers:{...headers,"Content-Length":String(part.byteLength),
      ...(range&&(range[1]||range[2])?{"Content-Range":`bytes ${start}-${end}/${size}`}:{})}});
  }catch{return NextResponse.json({error:"Videoni yuklab bo‘lmadi"},{status:503,headers:privateHeaders});}
}
