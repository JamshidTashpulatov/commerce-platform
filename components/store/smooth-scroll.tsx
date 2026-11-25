"use client";
import {useEffect} from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import {setLenis} from "../../lib/smooth-scroll";

/**
 * Inertial smooth scrolling for mouse wheels and trackpads. Touch screens keep
 * native scrolling, which is already smooth; reduced motion turns it off.
 * It pauses while a dialog, drawer or the mobile menu locks the page, and
 * leaves nested scroll areas (cart, dialogs, shelves) to the browser.
 */
// Temporarily off at the owner's request (2026-11-25). Set to true to turn it back on.
export const SMOOTH_SCROLL_ENABLED=false;

export function SmoothScroll(){
  useEffect(()=>{
    if(!SMOOTH_SCROLL_ENABLED)return;
    document.documentElement.classList.add("sf-smooth");
    if(!window.matchMedia("(pointer: fine)").matches)return ()=>document.documentElement.classList.remove("sf-smooth");
    const instance=new Lenis({autoRaf:true,lerp:0.06,wheelMultiplier:0.9,smoothWheel:true,syncTouch:false,anchors:{offset:-64},
      autoToggle:true,allowNestedScroll:true,stopInertiaOnNavigate:true});
    setLenis(instance);
    return ()=>{setLenis(null);instance.destroy();document.documentElement.classList.remove("sf-smooth");};
  },[]);
  return null;
}
