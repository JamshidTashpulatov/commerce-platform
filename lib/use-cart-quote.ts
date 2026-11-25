"use client";
import {useEffect,useState} from "react";

export type Quote={variantId:string;productId:string;name:string;category:string;options:string;image:string|null;
  unitPrice:string;quantity:number;available:boolean;inStock:boolean};

/** Re-reads price, availability and stock from the server whenever the given lines change. */
export function useQuote(lines:{variantId:string;quantity:number}[],enabled=true){
  const key=JSON.stringify(lines.map(l=>[l.variantId,l.quantity]));
  const [state,setState]=useState<{key:string;quotes:Quote[];error:string}>({key:"",quotes:[],error:""});
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!enabled||!lines.length){setState({key,quotes:[],error:""});return;}
    let active=true;
    const timer=setTimeout(async()=>{
      try{
        const res=await fetch("/api/cart",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lines:lines.map(l=>({variantId:l.variantId,quantity:l.quantity}))}),cache:"no-store"});
        const data=await res.json().catch(()=>null);
        if(!res.ok)throw new Error(data?.error??"Savat yangilanmadi");
        if(active)setState({key,quotes:data.lines,error:""});
      }catch(e){if(active)setState(s=>({...s,key,error:e instanceof Error?e.message:"Savat yangilanmadi"}));}
    },150);
    return ()=>{active=false;clearTimeout(timer);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key,enabled,retry]);
  return {quotes:state.quotes,loading:enabled&&lines.length>0&&state.key!==key,error:state.error,retry:()=>setRetry(r=>r+1)};
}
