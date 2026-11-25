"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {Loader2Icon,ShieldCheckIcon} from "lucide-react";
import {cn} from "@/lib/utils";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {contactStore,maskPhone} from "../../lib/contact-store";
import {TELEGRAM_URL} from "../../lib/storefront";
import type {Quote} from "../../lib/use-cart-quote";
import {pill} from "./bits";

export type CustomerInfo={name:string|null;phoneMasked:string|null}|null;
export type TelegramLogin={configured:boolean;customer:CustomerInfo;startHref:string};
type Line={variantId:string;quantity:number;expectedPrice:string};
type Failure={message:string;code?:string;lines?:Quote[]};

const digits=(v:string)=>v.replace(/\D/g,"").replace(/^998/,"").slice(0,9);
const formatLocal=(d:string)=>[d.slice(0,2),d.slice(2,5),d.slice(5,7),d.slice(7,9)].filter(Boolean).join(" ");
const field="h-12 rounded-xl border-sf-line bg-white px-4 text-[17px] tracking-[-0.022em] text-sf-ink placeholder:text-sf-ink-3 focus-visible:border-sf-blue focus-visible:ring-sf-blue/20 md:text-[17px] aria-invalid:border-red-500";

/**
 * Contact form plus submit, shared by the cart checkout and one-click purchase.
 * Both go through POST /api/checkout; the server re-reads every price.
 */
export function CheckoutForm({channel,lines,telegram,submitLabel,onSuccess,onPriceChange,compact=false}:{
  channel:"cart"|"one_click";lines:Line[];telegram:TelegramLogin;submitLabel:string;
  onSuccess:(reference:string)=>void;onPriceChange?:(lines:Quote[])=>void;compact?:boolean;
}){
  const saved=contactStore.use();
  const tg=telegram.customer;
  const [name,setName]=useState("");
  const [phone,setPhone]=useState("");
  const [useTelegramPhone,setUseTelegramPhone]=useState(false);
  const [comment,setComment]=useState("");
  const [remember,setRemember]=useState(false);
  const [editing,setEditing]=useState(false);
  const [touched,setTouched]=useState(false);
  const [sending,setSending]=useState(false);
  const [failure,setFailure]=useState<Failure|null>(null);
  const honeypot=useRef<HTMLInputElement>(null);

  // Prefill once from Telegram or from details remembered on this device.
  const filled=useRef(false);
  useEffect(()=>{
    if(filled.current)return;
    if(tg?.name||saved){filled.current=true;}
    if(tg?.name)setName(tg.name);else if(saved)setName(saved.name);
    if(tg?.phoneMasked)setUseTelegramPhone(true);else if(saved)setPhone(saved.phone.slice(4));
    if(saved)setRemember(true);
  },[tg,saved]);

  // One request key per exact content: a retry of the same request is deduplicated by the server.
  const signature=JSON.stringify(lines.map(l=>[l.variantId,l.quantity,l.expectedPrice]))+channel;
  const requestKey=useMemo(()=>crypto.randomUUID(),[signature]); // eslint-disable-line react-hooks/exhaustive-deps

  const local=digits(phone);
  const nameOk=name.trim().length>=2&&/\p{L}/u.test(name);
  const phoneOk=useTelegramPhone||local.length===9;
  const known=!editing&&nameOk&&phoneOk&&(!!saved||!!tg?.name);

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();setTouched(true);setFailure(null);
    if(!nameOk||!phoneOk||!lines.length)return;
    setSending(true);
    try{
      const res=await fetch("/api/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        requestKey,channel,lines,name:name.trim(),phone:useTelegramPhone?null:"+998"+local,useTelegramPhone,
        comment:comment.trim()||null,website:honeypot.current?.value??""})});
      const data=await res.json().catch(()=>null);
      if(res.ok&&data?.reference){
        if(remember&&!useTelegramPhone)contactStore.set({name:name.trim(),phone:"+998"+local});
        else if(!remember)contactStore.set(null);
        onSuccess(data.reference);return;
      }
      if(data?.code==="price_changed"&&data.lines)onPriceChange?.(data.lines);
      setFailure({message:data?.error??"Buyurtma yuborilmadi. Qayta urinib ko‘ring.",code:data?.code,lines:data?.lines});
    }catch{setFailure({message:"Internet aloqasini tekshirib, qayta urinib ko‘ring."});}
    finally{setSending(false);}
  };

  return <form onSubmit={submit} noValidate className="flex flex-col gap-5">
    {telegram.configured&&!tg&&<div className="flex flex-col gap-3">
      <a href={telegram.startHref} className={pill({tone:"ghost",className:"w-full gap-2"})}><TelegramIcon/>Telegram orqali davom etish</a>
      <p className="flex items-center gap-3 text-xs text-sf-ink-3"><span className="h-px flex-1 bg-sf-line"/>yoki ma’lumotlarni kiriting<span className="h-px flex-1 bg-sf-line"/></p>
    </div>}

    {known?<div className="flex items-start justify-between gap-4 rounded-xl bg-sf-alt p-4">
      <div className="min-w-0">
        <p className="text-xs text-sf-ink-2">{tg?.name?"Telegram orqali":"Shu qurilmada saqlangan"}</p>
        <p className="mt-1 truncate font-semibold">{name}</p>
        <p className="text-sm text-sf-ink-2 tabular-nums">{useTelegramPhone?tg?.phoneMasked:maskPhone("+998"+local)}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5 text-sm">
        <button type="button" className="cursor-pointer text-sf-link hover:underline" onClick={()=>setEditing(true)}>O‘zgartirish</button>
        {saved&&!tg&&<button type="button" className="cursor-pointer text-sf-ink-3 hover:text-sf-ink-2" onClick={()=>{contactStore.set(null);setName("");setPhone("");setRemember(false);setEditing(true);}}>Meni unut</button>}
      </div>
    </div>:<>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">Ismingiz</span>
        <Input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" maxLength={80} placeholder="Ism va familiya"
          aria-invalid={touched&&!nameOk} className={field}/>
        {touched&&!nameOk&&<span className="text-xs text-red-600">Ismingizni kiriting.</span>}
      </label>
      {tg?.phoneMasked&&<label className="flex cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" checked={useTelegramPhone} onChange={e=>setUseTelegramPhone(e.target.checked)} className="size-4 accent-sf-blue"/>
        Telegram’dagi raqamim: <span className="tabular-nums">{tg.phoneMasked}</span>
      </label>}
      {!useTelegramPhone&&<label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">Telefon raqamingiz</span>
        <div className="relative flex items-center">
          <span className="pointer-events-none absolute left-4 text-[17px] text-sf-ink tabular-nums">+998</span>
          <Input value={formatLocal(local)} onChange={e=>setPhone(e.target.value)} inputMode="tel" autoComplete="tel-national" placeholder="90 123 45 67"
            aria-invalid={touched&&!phoneOk} aria-describedby="phone-hint" className={cn(field,"pl-[68px] tabular-nums")}/>
        </div>
        <span id="phone-hint" className={cn("text-xs",touched&&!phoneOk?"text-red-600":"text-sf-ink-3")}>
          {touched&&!phoneOk?"Raqam 9 ta raqamdan iborat bo‘lishi kerak, masalan 90 123 45 67.":"Sotuvchi shu raqamga qo‘ng‘iroq qilib, buyurtmani tasdiqlaydi."}
        </span>
      </label>}
    </>}

    {!compact&&<label className="flex flex-col gap-2">
      <span className="text-sm font-semibold">Izoh <span className="font-normal text-sf-ink-3">(ixtiyoriy)</span></span>
      <Textarea value={comment} onChange={e=>setComment(e.target.value)} maxLength={500} rows={3} placeholder="Qulay vaqt yoki manzil haqida"
        className="rounded-xl border-sf-line bg-white px-4 py-3 text-[17px] md:text-[17px] focus-visible:border-sf-blue focus-visible:ring-sf-blue/20"/>
    </label>}

    {/* Honeypot: hidden from people and assistive tech, bots tend to fill it. */}
    <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden opacity-0">
      <label>Veb-sayt (bo‘sh qoldiring)<input ref={honeypot} name="website" tabIndex={-1} autoComplete="off"/></label>
    </div>

    {!known&&!useTelegramPhone&&<label className="flex cursor-pointer items-start gap-3 text-sm text-sf-ink-2">
      <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} className="mt-0.5 size-4 accent-sf-blue"/>
      Ism va raqamimni shu qurilmada eslab qolish
    </label>}

    {failure&&<div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
      <p>{failure.message}</p>
      {(failure.code==="disabled"||failure.code==="rate_limited")&&<a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold text-sf-link hover:underline">Telegram orqali yozish</a>}
    </div>}

    <button type="submit" disabled={sending||!lines.length} className={pill({className:"w-full gap-2"})}>
      {sending&&<Loader2Icon className="size-4 animate-spin"/>}{sending?"Yuborilmoqda":submitLabel}
    </button>
    <p className="flex items-start gap-2 text-xs leading-[1.5] text-sf-ink-3">
      <ShieldCheckIcon className="mt-px size-4 shrink-0" aria-hidden="true"/>
      <span>“{submitLabel}” tugmasini bosib, ismingiz va telefon raqamingiz buyurtmani tasdiqlash uchun sotuvchiga berilishiga rozilik bildirasiz. Ular shifrlangan holda saqlanadi va boshqa maqsadda ishlatilmaydi. Onlayn to‘lov yo‘q.</span>
    </p>
  </form>;
}

export function TelegramIcon({className="size-[18px]"}:{className?:string}){
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path fill="currentColor" d="M21.9 4.3 18.7 19.4c-.2 1.1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13l-4.8-1.5c-1.1-.3-1.1-1.1.2-1.6L20.5 2.6c.9-.3 1.7.2 1.4 1.7z"/></svg>;
}
