"use client";
import {useRef,useState,type CSSProperties} from "react";
import {ChevronLeftIcon,ChevronRightIcon,Maximize2Icon} from "lucide-react";
import {cn} from "@/lib/utils";
import {Button} from "@/components/ui/button";
import type {Tone} from "../../lib/server/storefront";
import {ProductVisual,imageSources} from "./product-visual";
import {Lightbox} from "./lightbox";

const ZOOM=2.5,LENS=200;

/**
 * Product gallery. The frame takes the photo's own proportions so the photo
 * covers it without bars. Hovering with a mouse shows a magnifier lens; a
 * click opens the full-screen viewer.
 */
export function Gallery({images,index,onIndex,name,category,tones}:{
  images:string[];index:number;onIndex:(i:number)=>void;name:string;category:string;tones:Record<string,Tone>;
}){
  const current=images[index]??null;
  const src=current?imageSources(current):null;
  const [loadedRatio,setLoadedRatio]=useState<Record<string,number>>({});
  const ratio=Math.min(1.6,Math.max(0.85,(src?.ratio??(current?loadedRatio[current]:undefined))??4/3));
  const [open,setOpen]=useState(false);
  const frame=useRef<HTMLDivElement>(null);
  const lens=useRef<HTMLDivElement>(null);
  const count=images.length;
  const go=(dir:1|-1)=>onIndex((index+dir+count)%count);

  // The lens is moved directly on the element: no React render per mouse move.
  const onMove=(e:React.PointerEvent)=>{
    const f=frame.current,l=lens.current,img=f?.querySelector("img");
    if(e.pointerType!=="mouse"||!f||!l||!img||!img.naturalWidth)return;
    const r=f.getBoundingClientRect();
    const cover=!src?.alpha;
    // Size and position of the picture as drawn inside the frame.
    const scale=(cover?Math.max:Math.min)(r.width/img.naturalWidth,r.height/img.naturalHeight)*(cover?1:0.9);
    const w=img.naturalWidth*scale,h=img.naturalHeight*scale,ox=(r.width-w)/2,oy=(r.height-h)/2;
    const x=e.clientX-r.left,y=e.clientY-r.top;
    const inside=x>=ox&&x<=ox+w&&y>=oy&&y<=oy+h;
    l.style.opacity=inside?"1":"0";
    if(!inside)return;
    l.style.transform=`translate3d(${x-LENS/2}px,${y-LENS/2}px,0)`;
    l.style.backgroundSize=`${w*ZOOM}px ${h*ZOOM}px`;
    l.style.backgroundPosition=`${-((x-ox)*ZOOM-LENS/2)}px ${-((y-oy)*ZOOM-LENS/2)}px`;
  };
  const hideLens=()=>{if(lens.current)lens.current.style.opacity="0";};

  const tone=current?tones[current]:undefined;
  return <div className="min-w-0 desktop:sticky desktop:top-[76px]">
    <div ref={frame} style={{aspectRatio:ratio,"--tile-bg":tone?.background??"#f5f5f7"} as CSSProperties}
      className="group relative max-h-[80vh] w-full cursor-zoom-in overflow-hidden rounded-[18px] bg-(--tile-bg) transition-[aspect-ratio,background-color] duration-300"
      onPointerMove={onMove} onPointerLeave={hideLens} onClick={()=>current&&setOpen(true)}>
      <ProductVisual key={current??"none"} image={current} name={name} category={category} priority
        className="absolute inset-0 animate-sf-fade" sizes="(min-width:1069px) 620px, 100vw"/>
      {current&&<img src={src!.hiRes} alt="" aria-hidden="true" className="hidden" referrerPolicy="no-referrer"
        onLoad={e=>{const i=e.currentTarget;if(i.naturalHeight)setLoadedRatio(r=>({...r,[current]:i.naturalWidth/i.naturalHeight}));}}/>}
      {current&&<div ref={lens} aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 hidden rounded-full border-2 border-white bg-(--tile-bg) bg-no-repeat opacity-0 shadow-[0_8px_30px_rgba(0,0,0,0.22),0_0_0_1px_rgba(0,0,0,0.06)] transition-opacity duration-150 pointer-fine:block"
        style={{width:LENS,height:LENS,backgroundImage:`url("${src!.hiRes}")`}}/>}
      {current&&<Button variant="ghost" size="icon" aria-label="Rasmni kattalashtirib ko‘rish" onClick={e=>{e.stopPropagation();setOpen(true);}}
        className="absolute right-3 bottom-3 size-9 rounded-full bg-white/85 text-sf-ink shadow-sm backdrop-blur hover:bg-white"><Maximize2Icon className="size-4"/></Button>}
      {count>1&&<>
        <Button variant="ghost" size="icon" aria-label="Oldingi rasm" onClick={e=>{e.stopPropagation();go(-1);}}
          className="absolute top-1/2 left-3 size-9 -translate-y-1/2 rounded-full bg-white/85 text-sf-ink shadow-sm backdrop-blur hover:bg-white pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-visible:opacity-100"><ChevronLeftIcon/></Button>
        <Button variant="ghost" size="icon" aria-label="Keyingi rasm" onClick={e=>{e.stopPropagation();go(1);}}
          className="absolute top-1/2 right-3 size-9 -translate-y-1/2 rounded-full bg-white/85 text-sf-ink shadow-sm backdrop-blur hover:bg-white pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-visible:opacity-100"><ChevronRightIcon/></Button>
      </>}
    </div>
    {count>1&&<div className="sf-no-scrollbar mt-4 flex gap-2.5 overflow-x-auto p-0.5" role="group" aria-label="Rasmlar">
      {images.map((u,i)=><button type="button" key={u} aria-pressed={i===index} aria-label={`${i+1}-rasm`} onClick={()=>onIndex(i)}
        style={{"--tile-bg":tones[u]?.background??"#f5f5f7"} as CSSProperties}
        data-tone className="relative aspect-4/3 w-[76px] flex-none cursor-pointer overflow-hidden rounded-[10px] bg-(--tile-bg) opacity-70 ring-1 ring-black/5 transition-[opacity,box-shadow] duration-200 hover:opacity-100 aria-pressed:opacity-100 aria-pressed:ring-2 aria-pressed:ring-sf-blue">
        <ProductVisual image={u} name="" category={category} sizes="76px" cutoutPadding={false} fit="blend" className="absolute inset-0"/>
      </button>)}
    </div>}
    <Lightbox images={images} index={index} onIndex={onIndex} open={open} onOpenChange={setOpen} name={name}/>
  </div>;
}
