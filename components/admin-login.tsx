"use client";
import {useState,type FormEvent} from "react";

export function AdminLogin({activate=false,change=false}:{activate?:boolean;change?:boolean}){
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function submit(e:FormEvent<HTMLFormElement>){
   e.preventDefault();
   if(busy)return;
   setBusy(true);setError("");
   const fields=new FormData(e.currentTarget);
   try{
     const res=await fetch("/api/auth/admin",{method:"POST",headers:{"Content-Type":"application/json"},
       body:JSON.stringify({action:activate?"activate":change?"change":"login",email:fields.get("email"),password:fields.get("password"),code:fields.get("code"),newPassword:fields.get("newPassword")})});
     if(!res.ok){setError((await res.json()).error);setBusy(false);return;}
     window.location.replace("/staff");
   }catch{setError("Ulanishni tekshirib, qayta urinib ko‘ring.");setBusy(false);}
 }
 return <form className="surface order-workspace" onSubmit={submit}>
 <h2>{activate?"Admin parolini belgilash":change?"Admin parolini o‘zgartirish":"Administrator uchun kirish"}</h2>
 <label>Email<input name="email" type="email" autoComplete="username" maxLength={254} required/></label>
 {activate&&<label>Faollashtirish kodi<input name="code" type="password" autoComplete="off" required/></label>}
 <label>{activate?"Yangi parol (kamida 15 belgi)":"Parol"}<input name="password" type="password" minLength={activate?15:1}
 autoComplete={activate?"new-password":"current-password"} required/></label>
 {change&&<label>Yangi parol (kamida 15 belgi)<input name="newPassword" type="password" minLength={15} autoComplete="new-password" required/></label>}
 <button className="primary" disabled={busy}>{activate||change?"Parolni saqlash":"Kirish"}</button>{error&&<p role="alert">{error}</p>}</form>;
}
