"use client";
import {useSyncExternalStore} from "react";

/**
 * A tiny persisted store in localStorage, shared by every component and kept
 * in sync across tabs. Storage can be unavailable (private mode, blocked
 * cookies): the store then works in memory for this page only.
 */
export function createLocalStore<T>(key:string,fallback:T,valid:(value:unknown)=>value is T){
  let value:T=fallback;
  let loaded=false;
  const listeners=new Set<()=>void>();
  const read=()=>{
    try{
      const raw=window.localStorage.getItem(key);
      const parsed=raw?JSON.parse(raw):fallback;
      value=valid(parsed)?parsed:fallback;
    }catch{value=fallback;}
  };
  const emit=()=>listeners.forEach(l=>l());
  const subscribe=(l:()=>void)=>{
    listeners.add(l);
    const onStorage=(e:StorageEvent)=>{if(e.key===key){read();emit();}};
    window.addEventListener("storage",onStorage);
    return ()=>{listeners.delete(l);window.removeEventListener("storage",onStorage);};
  };
  const get=()=>{if(!loaded){loaded=true;read();}return value;};
  const set=(next:T|((prev:T)=>T))=>{
    value=typeof next==="function"?(next as (prev:T)=>T)(get()):next;
    try{window.localStorage.setItem(key,JSON.stringify(value));}catch{/* memory only */}
    emit();
  };
  const use=()=>useSyncExternalStore(subscribe,get,()=>fallback);
  return {use,get,set};
}
