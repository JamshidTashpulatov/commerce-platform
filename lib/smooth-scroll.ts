"use client";
import type Lenis from "lenis";

// The active Lenis instance (desktop pointer only), so in-page jumps use the same smoothing.
let lenis:Lenis|null=null;
export const setLenis=(instance:Lenis|null)=>{lenis=instance;};

/** Scroll the page to an element below the sticky nav, smoothly unless reduced motion is on. */
export function scrollToElement(el:HTMLElement,offset=-64){
  if(lenis){lenis.scrollTo(el,{offset});return;}
  const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY+offset,behavior:reduce?"auto":"smooth"});
}
