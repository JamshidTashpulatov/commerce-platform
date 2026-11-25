"use client";
import {useEffect,useRef,useState,type ReactNode} from "react";

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
  return <div className="sf-shelf">
    <div className="sf-shelf-track" ref={track} role="list" aria-label={label} tabIndex={0}>
      {Array.isArray(children)?children.map((c,i)=><div role="listitem" key={i} className="sf-shelf-item">{c}</div>):children}
    </div>
    <div className="sf-paddles">
      <button type="button" className="sf-paddle" aria-label="Oldingilar" disabled={edges.start} onClick={()=>move(-1)}>
        <svg viewBox="0 0 8 14" width="8" height="14" aria-hidden="true"><path d="M7 1L1 7l6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      <button type="button" className="sf-paddle" aria-label="Keyingilar" disabled={edges.end} onClick={()=>move(1)}>
        <svg viewBox="0 0 8 14" width="8" height="14" aria-hidden="true"><path d="M1 1l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
    </div>
  </div>;
}
