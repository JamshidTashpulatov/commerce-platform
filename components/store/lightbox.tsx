"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {ChevronLeftIcon,ChevronRightIcon,MinusIcon,PlusIcon,RotateCcwIcon,XIcon} from "lucide-react";
import {cn} from "@/lib/utils";
import {Button} from "@/components/ui/button";
import {Dialog,DialogClose,DialogContent,DialogDescription,DialogTitle} from "@/components/ui/dialog";
import {imageSources} from "./product-visual";

const MIN=1,MAX=5,STEP=0.75;
type View={z:number;x:number;y:number};
const RESET:View={z:1,x:0,y:0};

/**
 * Full-screen image viewer: zoom with buttons, wheel, double click or pinch;
 * drag to pan when zoomed; swipe, arrows or thumbnails to change image.
 */
export function Lightbox({images,index,onIndex,open,onOpenChange,name}:{
  images:string[];index:number;onIndex:(i:number)=>void;open:boolean;onOpenChange:(open:boolean)=>void;name:string;
}){
  const [view,setView]=useState<View>(RESET);
  const [dragging,setDragging]=useState(false);
  const stage=useRef<HTMLDivElement>(null);
  const img=useRef<HTMLImageElement>(null);
  const pointers=useRef(new Map<number,{x:number;y:number}>());
  const gesture=useRef<{startX:number;startY:number;view:View;dist:number;moved:boolean}|null>(null);
  const count=images.length;

  const go=useCallback((dir:1|-1)=>{if(count>1){onIndex((index+dir+count)%count);setView(RESET);}},[count,index,onIndex]);
  useEffect(()=>{setView(RESET);},[index,open]);

  // Keep the zoomed image covering the stage: no panning past its edges.
  const clamp=useCallback((v:View):View=>{
    const s=stage.current,i=img.current;
    if(!s||!i)return v;
    const z=Math.min(MAX,Math.max(MIN,v.z));
    const maxX=Math.max(0,(i.offsetWidth*z-s.clientWidth)/2),maxY=Math.max(0,(i.offsetHeight*z-s.clientHeight)/2);
    return {z,x:Math.min(maxX,Math.max(-maxX,v.x)),y:Math.min(maxY,Math.max(-maxY,v.y))};
  },[]);
  // Zoom keeping the point under (px,py), given relative to the stage centre, still.
  const zoomAt=useCallback((z:number,px=0,py=0)=>setView(v=>{
    const nz=Math.min(MAX,Math.max(MIN,z));
    return clamp({z:nz,x:px-(px-v.x)*(nz/v.z),y:py-(py-v.y)*(nz/v.z)});
  }),[clamp]);
  const fromCentre=(clientX:number,clientY:number)=>{
    const r=stage.current!.getBoundingClientRect();
    return [clientX-r.left-r.width/2,clientY-r.top-r.height/2] as const;
  };

  useEffect(()=>{
    if(!open)return;
    const onKey=(e:KeyboardEvent)=>{
      if(e.key==="ArrowRight")go(1);
      else if(e.key==="ArrowLeft")go(-1);
      else if(e.key==="+"||e.key==="=")zoomAt(view.z+STEP);
      else if(e.key==="-")zoomAt(view.z-STEP);
      else if(e.key==="0")setView(RESET);
    };
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[open,go,zoomAt,view.z]);

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(()=>{
    const s=stage.current;if(!open||!s)return;
    const onWheel=(e:WheelEvent)=>{e.preventDefault();const [px,py]=fromCentre(e.clientX,e.clientY);setView(v=>{
      const nz=Math.min(MAX,Math.max(MIN,v.z*Math.exp(-e.deltaY*0.0025)));
      return clamp({z:nz,x:px-(px-v.x)*(nz/v.z),y:py-(py-v.y)*(nz/v.z)});
    });};
    s.addEventListener("wheel",onWheel,{passive:false});
    return ()=>s.removeEventListener("wheel",onWheel);
  },[open,clamp,index]);

  const onDown=(e:React.PointerEvent)=>{
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const pts=[...pointers.current.values()];
    gesture.current={startX:e.clientX,startY:e.clientY,view,moved:false,
      dist:pts.length===2?Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y):0};
    setDragging(true);
  };
  const onMove=(e:React.PointerEvent)=>{
    const g=gesture.current;if(!g||!pointers.current.has(e.pointerId))return;
    pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const pts=[...pointers.current.values()];
    if(pts.length===2&&g.dist){
      const d=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
      const [px,py]=fromCentre((pts[0].x+pts[1].x)/2,(pts[0].y+pts[1].y)/2);
      const nz=Math.min(MAX,Math.max(MIN,g.view.z*d/g.dist));
      g.moved=true;
      setView(clamp({z:nz,x:px-(px-g.view.x)*(nz/g.view.z),y:py-(py-g.view.y)*(nz/g.view.z)}));
      return;
    }
    const dx=e.clientX-g.startX,dy=e.clientY-g.startY;
    if(Math.abs(dx)+Math.abs(dy)>4)g.moved=true;
    if(g.view.z>1)setView(clamp({...g.view,x:g.view.x+dx,y:g.view.y+dy}));
    else setView({z:1,x:dx*0.6,y:0});
  };
  const onUp=(e:React.PointerEvent)=>{
    const g=gesture.current;
    pointers.current.delete(e.pointerId);
    if(pointers.current.size>0){
      // One finger left after a pinch: continue as a pan from here.
      const [p]=[...pointers.current.values()];
      gesture.current={startX:p.x,startY:p.y,view,moved:true,dist:0};
      return;
    }
    setDragging(false);gesture.current=null;
    if(g&&g.view.z===1&&view.z===1){
      const dx=e.clientX-g.startX;
      if(Math.abs(dx)>60)go(dx<0?1:-1);
      else setView(RESET);
    }
  };
  const onDouble=(e:React.MouseEvent)=>{
    const [px,py]=fromCentre(e.clientX,e.clientY);
    if(view.z>1)setView(RESET);else zoomAt(2.5,px,py);
  };

  const current=images[index];
  const src=current?imageSources(current):null;
  const iconBtn="size-10 rounded-full bg-black/[0.06] text-sf-ink hover:bg-black/10 disabled:opacity-30 [&_svg:not([class*='size-'])]:size-5";

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent data-lenis-prevent showCloseButton={false}
      className="top-0 left-0 flex h-dvh max-h-none w-screen max-w-none overflow-hidden translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-white p-0 font-sf text-sf-ink ring-0 sm:max-w-none">
      <DialogTitle className="sr-only">{name}. Rasmlar</DialogTitle>
      <DialogDescription className="sr-only">Kattalashtirish uchun ikki marta bosing yoki g‘ildirakdan foydalaning. Rasmlar orasida strelkalar bilan o‘ting.</DialogDescription>
      <div className="flex items-center justify-between gap-3 px-4 py-3 tablet:px-6">
        <p className="text-sm text-sf-ink-2 tabular-nums" aria-live="polite">{index+1} / {count}</p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className={iconBtn} aria-label="Kichraytirish" disabled={view.z<=MIN} onClick={()=>zoomAt(view.z-STEP)}><MinusIcon/></Button>
          <span className="w-12 text-center text-sm text-sf-ink-2 tabular-nums">{Math.round(view.z*100)}%</span>
          <Button variant="ghost" size="icon" className={iconBtn} aria-label="Kattalashtirish" disabled={view.z>=MAX} onClick={()=>zoomAt(view.z+STEP)}><PlusIcon/></Button>
          <Button variant="ghost" size="icon" className={iconBtn} aria-label="Asl o‘lcham" disabled={view.z===1&&view.x===0} onClick={()=>setView(RESET)}><RotateCcwIcon/></Button>
          <DialogClose render={<Button variant="ghost" size="icon" className={cn(iconBtn,"ml-2")} aria-label="Yopish"/>}><XIcon/></DialogClose>
        </div>
      </div>

      <div ref={stage} className={cn("relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden select-none",
          view.z>1?(dragging?"cursor-grabbing":"cursor-grab"):"cursor-zoom-in")}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onDoubleClick={onDouble}>
        {src&&<img ref={img} key={current} src={src.hiRes} alt={`${name}, ${index+1}-rasm`} draggable={false} referrerPolicy="no-referrer"
          className={cn("max-h-full max-w-full object-contain will-change-transform",!dragging&&"transition-transform duration-300 ease-sf")}
          style={{transform:`translate3d(${view.x}px,${view.y}px,0) scale(${view.z})`}}/>}
        {count>1&&<>
          <Button variant="ghost" size="icon" aria-label="Oldingi rasm" onClick={()=>go(-1)} onPointerDown={e=>e.stopPropagation()}
            className={cn(iconBtn,"absolute top-1/2 left-3 hidden -translate-y-1/2 bg-white/80 shadow-sm backdrop-blur tablet:inline-flex tablet:left-6")}><ChevronLeftIcon/></Button>
          <Button variant="ghost" size="icon" aria-label="Keyingi rasm" onClick={()=>go(1)} onPointerDown={e=>e.stopPropagation()}
            className={cn(iconBtn,"absolute top-1/2 right-3 hidden -translate-y-1/2 bg-white/80 shadow-sm backdrop-blur tablet:inline-flex tablet:right-6")}><ChevronRightIcon/></Button>
        </>}
      </div>

      {count>1&&<div className="sf-no-scrollbar flex justify-center-safe gap-2.5 overflow-x-auto px-4 py-4" role="group" aria-label="Rasmlar">
        {images.map((u,i)=><button type="button" key={u} aria-label={`${i+1}-rasm`} aria-pressed={i===index} onClick={()=>{onIndex(i);setView(RESET);}}
          className="relative h-14 w-[72px] flex-none cursor-pointer overflow-hidden rounded-[10px] bg-sf-alt opacity-60 ring-1 ring-black/5 transition-[opacity,box-shadow] hover:opacity-100 aria-pressed:opacity-100 aria-pressed:ring-2 aria-pressed:ring-sf-blue">
          <img src={imageSources(u).src} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover"/>
        </button>)}
      </div>}
    </DialogContent>
  </Dialog>;
}
