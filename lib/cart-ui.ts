"use client";
import {useSyncExternalStore} from "react";
// Whether the cart drawer is open, shared by the nav button and "add to cart" actions.
let open=false;const listeners=new Set<()=>void>();
export const cartUi={
  open:()=>{open=true;listeners.forEach(l=>l());},
  close:()=>{open=false;listeners.forEach(l=>l());},
  set:(v:boolean)=>{open=v;listeners.forEach(l=>l());},
  use:()=>useSyncExternalStore(l=>{listeners.add(l);return ()=>{listeners.delete(l);};},()=>open,()=>false),
};
