"use client";
import {useEffect} from "react";
import {useRouter} from "next/navigation";

// Opened inside the Telegram Mini App, the launch data identifies the customer:
// sign them in silently (customer session only) so checkout can prefill their name.
export function MiniAppSignIn(){
  const router=useRouter();
  useEffect(()=>{
    const initData=new URLSearchParams(window.location.hash.slice(1)).get("tgWebAppData");
    if(!initData)return;
    let done=false;
    try{done=sessionStorage.getItem("sf-miniapp-signin")==="1";}catch{/* storage off */}
    if(done)return;
    fetch("/api/customer/telegram/mini-app",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({initData})})
      .then(r=>{if(r.ok){try{sessionStorage.setItem("sf-miniapp-signin","1");}catch{/* storage off */}router.refresh();}})
      .catch(()=>{});
  },[router]);
  return null;
}
