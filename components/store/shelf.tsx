"use client";
import {Children,useEffect,useRef,useState,type ReactNode} from "react";
import {ChevronLeftIcon,ChevronRightIcon} from "lucide-react";
import {Button} from "@/components/ui/button";

// A horizontally scrolling row with paddle buttons on pointer devices.
export function Shelf({label,children}:{label:string;children:ReactNode}){
  const track=useRef<HTMLDivElement>(null);
  const [edges,setEdges]=useState({start:true,end:false});
  useEffect(()=>{
    const el=track.current;if(!el)return;
    const update=()=>setEdges({start:el.scrollLeft<4,end:el.scrollLeft+el.clientWidth>=el.scrollWidth-4});
    update();
    el.addEventListener("scroll",update,{passive:true});
    window.addEventListener("resize",update);
    return ()=>{el.removeEventListener("scroll",update);window.removeEventListener("resize",update);};
  },[]);
  const move=(dir:1|-1)=>{
    const el=track.current;if(!el)return;
    const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({left:dir*el.clientWidth*0.8,behavior:reduce?"auto":"smooth"});
  };
  const paddle="size-9 rounded-full bg-[rgba(210,210,215,0.64)] text-black/55 hover:bg-[rgba(223,223,227,0.7)] hover:text-black/65 disabled:opacity-40";
  return <div className="relative">
    <div ref={track} role="list" aria-label={label} tabIndex={0}
      className="sf-no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain px-[max(16px,calc((100%-980px)/2))] pt-2 pb-10 scroll-px-[max(16px,calc((100%-980px)/2))] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-sf-blue">
      {Children.map(children,c=><div role="listitem" className="flex-none snap-start">{c}</div>)}
    </div>
    <div className="mx-auto -mt-3 hidden max-w-[980px] justify-end gap-4 px-4 tablet:pointer-fine:flex">
      <Button variant="ghost" size="icon" className={paddle} aria-label="Oldingilar" disabled={edges.start} onClick={()=>move(-1)}><ChevronLeftIcon/></Button>
      <Button variant="ghost" size="icon" className={paddle} aria-label="Keyingilar" disabled={edges.end} onClick={()=>move(1)}><ChevronRightIcon/></Button>
    </div>
  </div>;
}
