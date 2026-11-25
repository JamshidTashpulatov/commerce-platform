import type {Metadata} from "next";
import Link from "next/link";
import {CheckCircle2Icon} from "lucide-react";
import {pill,wrap} from "../../../../components/store/bits";
import {TELEGRAM_URL} from "../../../../lib/storefront";

export const metadata:Metadata={title:"So‘rov qabul qilindi",robots:{index:false,follow:false}};

// Shows only the reference. Contact details are never put in the URL or on this page.
export default async function Done({searchParams}:{searchParams:Promise<{ref?:string}>}){
  const ref=(await searchParams).ref??"";
  const valid=/^MT-[0-9A-HJ-NP-Z]{8}$/.test(ref);
  return <div className={wrap+" flex min-h-[70vh] flex-col items-center justify-center py-16 text-center"}>
    <CheckCircle2Icon className="size-14 text-sf-green" strokeWidth={1.5} aria-hidden="true"/>
    <h1 className="mt-5 text-[32px] leading-[1.125] font-semibold tablet:text-5xl">So‘rovingiz qabul qilindi.</h1>
    {valid&&<p className="mt-4 text-[19px]">Raqami: <strong className="font-semibold tracking-wide tabular-nums">{ref}</strong></p>}
    <ol className="mt-10 grid w-full max-w-[720px] gap-4 text-left tablet:grid-cols-3">
      {[["Qo‘ng‘iroq","Sotuvchi ish vaqtida siz qoldirgan raqamga qo‘ng‘iroq qiladi."],
        ["Tasdiqlash","Narx, mavjudlik va topshirish shartlari birga kelishiladi."],
        ["To‘lov","Onlayn to‘lov yo‘q. To‘lov sotuvchi bilan kelishilgan tarzda amalga oshiriladi."]].map(([t,d],i)=>
        <li key={t} className="rounded-[18px] bg-sf-alt p-6"><span className="text-xs font-semibold text-sf-ink-2">{i+1}-qadam</span><h2 className="mt-1 text-[19px] font-semibold">{t}</h2><p className="mt-1 text-sm text-sf-ink-2">{d}</p></li>)}
    </ol>
    <p className="mt-8 max-w-[520px] text-sm text-sf-ink-2">Savol bo‘lsa, Telegram’da yozing va {valid?"yuqoridagi raqamni":"so‘rov raqamini"} ayting.</p>
    <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-3">
      <Link className={pill()} href="/catalog">Xaridni davom ettirish</Link>
      <a className={pill({tone:"ghost"})} href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">Telegram’da yozish</a>
    </div>
  </div>;
}
