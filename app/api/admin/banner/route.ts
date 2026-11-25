import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../lib/server/db";
import {requireStoreRole} from "../../../../lib/server/auth";
import {sameOrigin,smallJson,privateHeaders} from "../../../../lib/server/http";
import {localMediaId} from "../../../../lib/server/catalog-media";
import {bannerColumns,bannerVideoId,fromRow,parseBanner} from "../../../../lib/server/banner";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
const revision=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0&&v<2147483647;

export async function GET(){
  try{
    const store=configuredStoreId();if(!await requireStoreRole(store,["owner","admin"]))return reply({error:"Ruxsat yo‘q"},403);
    const r=await database().query(`SELECT ${bannerColumns},revision,updated_at FROM store_banners WHERE store_id=$1`,[store]);
    const row=r.rows[0];
    return reply({banner:row?{...fromRow(row),revision:row.revision,updatedAt:row.updated_at}:null,enabled:process.env.CATALOG_ADMIN_ENABLED==="true"});
  }catch{return reply({error:"Bannerni yuklab bo‘lmadi"},503);}
}

// Saves the banner. revision is null for the first save and the last revision read afterwards,
// so two editors never overwrite each other silently.
export async function POST(request:Request){
  if(!sameOrigin(request))return reply({error:"Ruxsat yo‘q"},403);
  const b=await smallJson(request);if(!b)return reply({error:"Ma’lumotlarni tekshiring"},400);
  if(b.revision!==null&&!revision(b.revision))return reply({error:"So‘rov ma’lumotlarini tekshiring"},400);
  const banner=parseBanner(b);if(typeof banner==="string")return reply({error:banner},400);
  try{
    const store=configuredStoreId();const actor=await requireStoreRole(store,["owner","admin"]);if(!actor)return reply({error:"Ruxsat yo‘q"},403);
    if(process.env.CATALOG_ADMIN_ENABLED!=="true")return reply({error:"Katalog tahriri hali yoqilmagan"},503);
    const c=await database().connect();
    try{
      await c.query("BEGIN");
      const media=banner.imageUrl?localMediaId(banner.imageUrl):null;
      if(media&&!(await c.query("SELECT 1 FROM catalog_media WHERE store_id=$1 AND id=$2",[store,media])).rowCount){await c.query("ROLLBACK");return reply({error:"Rasm ushbu katalogda topilmadi"},400);}
      const video=banner.videoUrl?bannerVideoId(banner.videoUrl):null;
      if(video&&!(await c.query("SELECT 1 FROM banner_videos WHERE store_id=$1 AND id=$2",[store,video])).rowCount){await c.query("ROLLBACK");return reply({error:"Video topilmadi"},400);}
      const values=[store,banner.eyebrow,banner.title,banner.subtitle,banner.imageUrl,banner.primaryLabel,banner.primaryHref,banner.secondaryLabel,banner.secondaryHref,banner.published,actor.account_id,banner.videoUrl];
      const r=b.revision===null
        ?await c.query(`INSERT INTO store_banners(store_id,eyebrow,title,subtitle,image_url,primary_label,primary_href,secondary_label,secondary_href,published,updated_by,video_url)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(store_id) DO NOTHING RETURNING revision`,values)
        :await c.query(`UPDATE store_banners SET eyebrow=$2,title=$3,subtitle=$4,image_url=$5,primary_label=$6,primary_href=$7,secondary_label=$8,
            secondary_href=$9,published=$10,updated_by=$11,video_url=$12,updated_at=now(),revision=revision+1 WHERE store_id=$1 AND revision=$13 RETURNING revision`,[...values,b.revision]);
      if(!r.rowCount){await c.query("ROLLBACK");return reply({error:"Bannerni boshqa xodim o‘zgartirgan. Sahifani yangilang."},409);}
      await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'banner_saved','store_banner',$1)",[store,actor.account_id]);
      await c.query("COMMIT");
      return reply({revision:r.rows[0].revision});
    }catch{await c.query("ROLLBACK");return reply({error:"Bannerni saqlab bo‘lmadi"},503);}finally{c.release();}
  }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
