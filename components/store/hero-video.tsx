"use client";
import {useEffect,useRef,useState} from "react";
import {PauseIcon,PlayIcon} from "lucide-react";
import {cn} from "@/lib/utils";

/**
 * The banner's muted looping video. It does not start on its own when the
 * visitor asks for reduced motion, and a button pauses or plays it, since
 * moving content that lasts more than a few seconds must be stoppable.
 */
export function HeroVideo({src,poster,dark}:{src:string;poster:string|null;dark:boolean}){
  const video=useRef<HTMLVideoElement>(null);
  const [playing,setPlaying]=useState(false);
  useEffect(()=>{
    const v=video.current;if(!v)return;
    if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches)v.play().catch(()=>{});
  },[]);
  const toggle=()=>{const v=video.current;if(!v)return;if(v.paused)v.play().catch(()=>{});else v.pause();};
  return <>
    <video ref={video} src={src} poster={poster??undefined} muted loop playsInline preload="metadata" aria-hidden="true"
      onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} className="absolute inset-0 size-full object-contain"/>
    <button type="button" onClick={toggle} aria-label={playing?"Videoni to‘xtatish":"Videoni ijro etish"}
      className={cn("absolute right-4 bottom-4 inline-flex size-9 cursor-pointer items-center justify-center rounded-full backdrop-blur transition-colors",
        dark?"bg-white/15 text-white hover:bg-white/25":"bg-black/[0.06] text-sf-ink hover:bg-black/10")}>
      {playing?<PauseIcon className="size-4" fill="currentColor" strokeWidth={0}/>:<PlayIcon className="size-4 translate-x-px" fill="currentColor" strokeWidth={0}/>}
    </button>
  </>;
}
