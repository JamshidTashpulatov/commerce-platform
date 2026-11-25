"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {XIcon} from "lucide-react";
import {cn} from "@/lib/utils";
import {COMPARE_MAX,compareHref,compareStore} from "../../lib/compare-store";
import {ProductVisual} from "./product-visual";
import {pill} from "./bits";

/** Floating tray listing the products picked for comparison, on every store page except the comparison itself. */
export function CompareTray(){
  const list=compareStore.use();
  const pathname=usePathname();
  if(!list.length||pathname==="/compare"||pathname.startsWith("/checkout"))return null;
  // The spacer keeps the end of the footer from hiding under the tray.
  return <><div aria-hidden="true" className="h-24 bg-sf-alt"/><div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(12px,env(safe-area-inset-bottom))] animate-in fade-in slide-in-from-bottom-4 duration-300">
    <section aria-label="Solishtirish ro‘yxati"
      className="mx-auto flex max-w-[720px] items-center gap-3 rounded-2xl bg-white/90 p-2.5 pl-4 shadow-[0_10px_40px_rgba(0,0,0,0.16),0_0_0_1px_rgba(0,0,0,0.06)] backdrop-blur-xl tablet:gap-4">
      <div className="hidden shrink-0 text-sm tablet:block"><p className="font-semibold">Solishtirish</p><p className="text-xs text-sf-ink-2">{list[0].category}, {list.length}/{COMPARE_MAX}</p></div>
      <ul className="flex min-w-0 flex-1 gap-2">
        {list.map(i=><li key={i.id} className="relative">
          <div className="relative size-12 overflow-hidden rounded-xl bg-sf-alt ring-1 ring-black/5" title={i.name}>
            <ProductVisual image={i.image} name={i.name} category={i.category} fit="blend" sizes="48px" cutoutPadding={false} className="absolute inset-0"/>
          </div>
          <button type="button" aria-label={i.name+"ni ro‘yxatdan olib tashlash"} onClick={()=>compareStore.set(l=>l.filter(x=>x.id!==i.id))}
            className="absolute -top-1.5 -right-1.5 inline-flex size-5 cursor-pointer items-center justify-center rounded-full bg-sf-ink text-white ring-2 ring-white"><XIcon className="size-3"/></button>
        </li>)}
        {Array.from({length:COMPARE_MAX-list.length},(_,k)=><li key={k} aria-hidden="true" className="size-12 rounded-xl border border-dashed border-sf-line"/>)}
      </ul>
      <button type="button" className="hidden cursor-pointer text-xs text-sf-ink-2 hover:text-sf-ink tablet:block" onClick={()=>compareStore.set([])}>Tozalash</button>
      <Link href={compareHref(list.map(i=>i.id))} className={cn(pill({size:"sm"}),"shrink-0")}>
        {list.length<2?"Solishtirish":`Solishtirish (${list.length})`}
      </Link>
    </section>
  </div></>;
}
