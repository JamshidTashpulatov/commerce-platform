import {ImageResponse} from "next/og";
import {readFile} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {database,configuredStoreId} from "../../lib/server/db";
import {approvedImageUrl,localMediaId} from "../../lib/server/catalog-media";
import {getProduct,listProducts} from "../../lib/server/storefront";
import {imageSources} from "../../lib/image-sources";
import {BRAND_MARK_PATH,STORE_NAME,STORE_TAGLINE,fromSoum,soum} from "../../lib/storefront";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const W=1200,H=630;
const fonts=Promise.all([600,700].map(async w=>({name:"Inter",weight:w as 600|700,style:"normal" as const,
  data:await readFile(path.join(process.cwd(),"assets/fonts/Inter-"+w+".ttf"))})));

// Only approved catalog images of published products reach this function. Images are
// converted to PNG (Satori does not read WebP) and kept small.
async function imageData(url:string|null){
  if(!url||!approvedImageUrl(url))return null;
  try{
    let bytes:Buffer;
    const id=localMediaId(url);
    if(id){
      const r=await database().query("SELECT image_bytes FROM catalog_media WHERE store_id=$1 AND id=$2",[configuredStoreId(),id]);
      if(!r.rowCount)return null;
      bytes=r.rows[0].image_bytes;
    }else{
      const res=await fetch(imageSources(url).src,{signal:AbortSignal.timeout(6000)});
      const length=Number(res.headers.get("content-length")??0);
      if(!res.ok||length>10_000_000)return null;
      bytes=Buffer.from(await res.arrayBuffer());
    }
    const image=sharp(bytes).resize(900,900,{fit:"inside",withoutEnlargement:true});
    const png=await image.clone().png().toBuffer();
    return {src:"data:image/png;base64,"+png.toString("base64"),bg:await edgeColour(image)};
  }catch{return null;}
}

// The dominant plain colour along the photo's border, so its tile matches a studio background.
async function edgeColour(image:ReturnType<typeof sharp>){
  const {data,info}=await image.clone().resize(32,32,{fit:"fill"}).flatten({background:"#f5f5f7"}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const px:number[][]=[];
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
    if(y>0&&y<info.height-1&&x>0&&x<info.width-1)continue;
    const i=(y*info.width+x)*3;px.push([data[i],data[i+1],data[i+2]]);
  }
  const counts=new Map<string,number[][]>();
  for(const p of px){const k=p.map(v=>v>>2).join(",");counts.set(k,[...(counts.get(k)??[]),p]);}
  const top=[...counts.values()].sort((a,b)=>b.length-a.length)[0][0];
  const near=px.filter(p=>Math.hypot(p[0]-top[0],p[1]-top[1],p[2]-top[2])<=10);
  if(near.length<px.length*0.6)return "#f5f5f7";
  return "rgb("+[0,1,2].map(c=>Math.round(near.reduce((s,p)=>s+p[c],0)/near.length)).join(",")+")";
}

function Mark({size=56}:{size?:number}){
  return <svg width={size} height={size} viewBox="0 0 24 24"><rect x="1" y="1" width="22" height="22" rx="7" fill="#1d1d1f"/>
    <path d={BRAND_MARK_PATH} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function Brand(){
  return <div style={{display:"flex",alignItems:"center",gap:16}}><Mark size={48}/><span style={{fontSize:34,fontWeight:700,letterSpacing:-0.5}}>{STORE_NAME}</span></div>;
}

const cache={"Cache-Control":"public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"};
const render=async(node:React.ReactElement)=>new ImageResponse(node,{width:W,height:H,fonts:await fonts,headers:cache});
const frame={width:W,height:H,display:"flex",background:"#ffffff",color:"#1d1d1f",fontFamily:"Inter"} as const;

function DefaultCard(){
  return <div style={{...frame,flexDirection:"column",justifyContent:"center",alignItems:"center",gap:28}}>
    <Mark size={120}/>
    <div style={{fontSize:84,fontWeight:700,letterSpacing:-2}}>{STORE_NAME}</div>
    <div style={{fontSize:38,fontWeight:600,color:"#6e6e73"}}>{`${STORE_TAGLINE}. Narxlar so‘mda.`}</div>
  </div>;
}

// GET /og            branded default
// GET /og?p=<id>     product: photo, name, category, starting price
// GET /og?c=<name>   category: up to three photos, model count, starting price
// Unknown or unpublished ids fall back to the default image.
export async function GET(request:Request){
  const params=new URL(request.url).searchParams;
  const productId=params.get("p"),category=params.get("c");
  try{
    if(productId){
      const p=await getProduct(productId);
      if(p){
        const img=await imageData(p.image);
        const oneprice=new Set(p.skus.map(s=>s.price)).size===1;
        return render(<div style={{...frame,padding:64,gap:48}}>
          <div style={{display:"flex",flexDirection:"column",justifyContent:"space-between",width:520}}>
            <Brand/>
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{fontSize:30,fontWeight:600,color:"#6e6e73"}}>{p.category}</div>
              <div style={{fontSize:p.name.length>18?60:74,fontWeight:700,lineHeight:1.05,letterSpacing:-1.5}}>{p.name}</div>
              <div style={{fontSize:40,fontWeight:600}}>{oneprice?soum(p.fromPrice):fromSoum(p.fromPrice)}</div>
            </div>
            <div style={{fontSize:24,fontWeight:600,color:"#6e6e73"}}>Buyurtma saytda. Sotuvchi tasdiqlaydi.</div>
          </div>
          <div style={{display:"flex",flex:1,alignItems:"center",justifyContent:"center",background:img?.bg??"#f5f5f7",borderRadius:40,overflow:"hidden"}}>
            {img?<img src={img.src} style={{maxWidth:"86%",maxHeight:"86%",objectFit:"contain"}}/>:<Mark size={160}/>}
          </div>
        </div>);
      }
    }
    if(category){
      const list=(await listProducts()).filter(p=>p.category===category);
      if(list.length){
        const picks=[...list].filter(p=>p.image).sort((a,b)=>BigInt(b.fromPrice)>BigInt(a.fromPrice)?1:-1).slice(0,3);
        const imgs=(await Promise.all(picks.map(p=>imageData(p.image)))).filter(x=>x!==null);
        const from=list.reduce((m,p)=>BigInt(p.fromPrice)<BigInt(m)?p.fromPrice:m,list[0].fromPrice);
        return render(<div style={{...frame,flexDirection:"column",padding:64,justifyContent:"space-between"}}>
          <Brand/>
          <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:32}}>
            <div style={{display:"flex",flexDirection:"column",gap:12,flexShrink:1}}>
              <div style={{fontSize:category.length>9?68:96,fontWeight:700,letterSpacing:-2,lineHeight:1}}>{category}</div>
              <div style={{fontSize:36,fontWeight:600,color:"#6e6e73"}}>{`${list.length} ta model. ${fromSoum(from)}.`}</div>
            </div>
            <div style={{display:"flex",gap:14,flexShrink:0}}>
              {imgs.map((img,i)=><div key={i} style={{display:"flex",width:168,height:220,alignItems:"center",justifyContent:"center",background:img.bg,borderRadius:28,border:"1px solid #ececf0"}}>
                <img src={img.src} style={{maxWidth:"86%",maxHeight:"86%",objectFit:"contain"}}/></div>)}
            </div>
          </div>
        </div>);
      }
    }
  }catch{/* fall through to the default image */}
  return render(<DefaultCard/>);
}
