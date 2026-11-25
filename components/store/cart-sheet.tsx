"use client";
import {useEffect} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {AlertTriangleIcon,MinusIcon,PlusIcon,ShoppingBagIcon,Trash2Icon,XIcon} from "lucide-react";
import {cn} from "@/lib/utils";
import {Sheet,SheetClose,SheetContent,SheetDescription,SheetTitle} from "@/components/ui/sheet";
import {Skeleton} from "@/components/ui/skeleton";
import {CART_MAX_QTY,cartCount,cartStore,removeLine,setQuantity,type CartLine} from "../../lib/cart-store";
import {cartUi} from "../../lib/cart-ui";
import {useQuote,type Quote} from "../../lib/use-cart-quote";
import {productHref} from "../../lib/storefront";
import {ProductVisual} from "./product-visual";
import {pill} from "./bits";
import {formatMoney} from "../../lib/money";

export function CartButton(){
  const lines=cartStore.use();
  const count=cartCount(lines);
  return <button type="button" onClick={cartUi.open} aria-label={count?`Savat, ${count} ta mahsulot`:"Savat bo‘sh"}
    className="relative inline-flex size-11 cursor-pointer items-center justify-center text-black/80 hover:text-black">
    <ShoppingBagIcon className="size-[18px]" strokeWidth={1.6}/>
    {count>0&&<span className="absolute top-1.5 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sf-ink px-1 text-[10px] font-semibold text-white tabular-nums">{count}</span>}
  </button>;
}

/** Totals and warnings for a cart, from the server's quote. Shared by the drawer and the checkout page. */
export function summarize(lines:CartLine[],quotes:Quote[]){
  const byId=new Map(quotes.map(q=>[q.variantId,q]));
  const rows=lines.map(l=>({line:l,quote:byId.get(l.variantId)}));
  const payable=rows.filter(r=>r.quote?.available);
  const total=payable.reduce((s,r)=>s+BigInt(r.quote!.unitPrice)*BigInt(r.line.quantity),BigInt(0));
  return {rows,payable,total,unavailable:rows.filter(r=>r.quote&&!r.quote.available).length,
    changed:rows.filter(r=>r.quote?.available&&r.quote.unitPrice!==r.line.seenPrice).length};
}

export function CartLines({lines,quotes,loading,editable=true}:{lines:CartLine[];quotes:Quote[];loading:boolean;editable?:boolean}){
  const {rows}=summarize(lines,quotes);
  return <ul className="flex flex-col divide-y divide-sf-line/70">
    {rows.map(({line,quote})=><li key={line.variantId} className="flex gap-4 py-5">
      <Link href={productHref(line.productId)} data-tone className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-sf-alt">
        {quote?<ProductVisual image={quote.image} name={quote.name} category={quote.category} fit="blend" sizes="80px" cutoutPadding={false} className="absolute inset-0"/>:<Skeleton className="size-full bg-sf-alt"/>}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {quote?<>
          <div className="min-w-0">
            <Link href={productHref(line.productId)} className="font-semibold hover:underline">{quote.name||"Mahsulot"}</Link>
            {quote.options&&<p className="text-sm text-sf-ink-2">{quote.options}</p>}
          </div>
          {!quote.available?<p className="flex items-start gap-1.5 text-sm text-red-700"><AlertTriangleIcon className="mt-0.5 size-4 shrink-0"/>Endi sotuvda yo‘q. Savatdan olib tashlang.</p>
          :<>
            <p className="text-xs text-sf-ink-2 tabular-nums">{line.quantity>1?`${formatMoney(quote.unitPrice)} × ${line.quantity}. `:""}{quote.inStock?"Mavjud":"Buyurtma asosida: sotuvchi muddatini aytadi"}</p>
            {quote.unitPrice!==line.seenPrice&&<p className="flex items-start gap-1.5 text-xs text-amber-800"><AlertTriangleIcon className="mt-px size-3.5 shrink-0"/>Narx o‘zgardi: avval {formatMoney(line.seenPrice)} edi.</p>}
          </>}
        </>:loading?<div className="flex flex-col gap-2"><Skeleton className="h-4 w-2/3 bg-sf-alt"/><Skeleton className="h-3 w-1/3 bg-sf-alt"/></div>
          :<p className="text-sm text-sf-ink-2">Ma’lumot yuklanmadi.</p>}
        {editable&&<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="inline-flex items-center rounded-full border border-sf-line" role="group" aria-label="Miqdor">
            <button type="button" className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-sf-ink-2 hover:text-sf-ink disabled:opacity-30" aria-label="Kamaytirish" disabled={line.quantity<=1} onClick={()=>setQuantity(line.variantId,line.quantity-1)}><MinusIcon className="size-3.5"/></button>
            <span className="w-7 text-center text-sm tabular-nums" aria-live="polite">{line.quantity}</span>
            <button type="button" className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-sf-ink-2 hover:text-sf-ink disabled:opacity-30" aria-label="Ko‘paytirish" disabled={line.quantity>=CART_MAX_QTY||!quote?.available} onClick={()=>setQuantity(line.variantId,line.quantity+1)}><PlusIcon className="size-3.5"/></button>
          </div>
          <button type="button" aria-label="O‘chirish" title="O‘chirish" className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-sf-ink-2 hover:bg-sf-alt hover:text-red-700" onClick={()=>removeLine(line.variantId)}><Trash2Icon className="size-4"/></button>
          <p className="ml-auto font-semibold tabular-nums">{quote?.available?formatMoney(BigInt(quote.unitPrice)*BigInt(line.quantity)):"—"}</p>
        </div>}
        {!editable&&quote?.available&&<p className="mt-1 font-semibold tabular-nums">{formatMoney(BigInt(quote.unitPrice)*BigInt(line.quantity))}</p>}
      </div>
    </li>)}
  </ul>;
}

export function CartSheet(){
  const open=cartUi.use();
  const lines=cartStore.use();
  const pathname=usePathname();
  const {quotes,loading,error,retry}=useQuote(lines,open);
  const {total,unavailable,changed,payable}=summarize(lines,quotes);
  useEffect(()=>{cartUi.close();},[pathname]);
  // Once the customer has seen a changed price in the cart, remember it as seen.
  const acknowledge=()=>cartStore.set(list=>list.map(l=>{const q=quotes.find(x=>x.variantId===l.variantId);return q?.available?{...l,seenPrice:q.unitPrice}:l;}));

  return <Sheet open={open} onOpenChange={cartUi.set}>
    <SheetContent showCloseButton={false} className="w-full data-[side=right]:w-full gap-0 bg-white p-0 font-sf text-sf-ink data-[side=right]:sm:max-w-[440px]">
      <div className="relative border-b border-sf-line/70 px-6 pt-6 pb-4">
        <SheetClose aria-label="Savatni yopish" className="absolute top-5 right-5 inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-sf-alt text-sf-ink-2 hover:text-sf-ink"><XIcon className="size-4"/></SheetClose>
        <SheetTitle className="text-2xl font-semibold">Savat</SheetTitle>
        <SheetDescription className="text-sm text-sf-ink-2">{lines.length?`${cartCount(lines)} ta mahsulot`:"Hozircha bo‘sh"}</SheetDescription>
      </div>
      {!lines.length?<div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
        <span className="inline-flex size-16 items-center justify-center rounded-full bg-sf-alt"><ShoppingBagIcon className="size-7 text-sf-ink-2" strokeWidth={1.5}/></span>
        <p className="text-[21px] font-semibold">Savatingiz bo‘sh.</p>
        <p className="text-sf-ink-2">Mahsulot sahifasida variantni tanlab, “Savatga qo‘shish” tugmasini bosing.</p>
        <Link href="/catalog" className={pill({size:"sm"})}>Katalogga o‘tish</Link>
      </div>:<>
        <div className="flex-1 overflow-y-auto overscroll-contain px-6" data-lenis-prevent>
          {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}. <button type="button" className="cursor-pointer font-semibold underline" onClick={retry}>Qayta urinish</button></p>}
          <CartLines lines={lines} quotes={quotes} loading={loading}/>
        </div>
        <div className="border-t border-sf-line/70 bg-white px-6 pt-4 pb-[max(24px,env(safe-area-inset-bottom))]">
          {(changed>0||unavailable>0)&&<p className="mb-3 text-xs text-amber-800">
            {unavailable>0&&"Sotuvda yo‘q mahsulotlar jamiga qo‘shilmadi. "}
            {changed>0&&<>Ba’zi narxlar o‘zgardi. <button type="button" className="cursor-pointer font-semibold underline" onClick={acknowledge}>Tushunarli</button></>}
          </p>}
          <div className="flex items-baseline justify-between">
            <span className="text-sf-ink-2">Jami</span>
            <span className="text-[24px] font-semibold tabular-nums">{loading&&!quotes.length?"…":formatMoney(total)}</span>
          </div>
          <p className="mt-1 text-xs text-sf-ink-3">Yetkazib berish narxi yo‘q. To‘lov sotuvchi bilan kelishiladi.</p>
          <Link href="/checkout" aria-disabled={!payable.length} onClick={e=>{if(!payable.length)e.preventDefault();}}
            className={pill({className:cn("mt-4 w-full",!payable.length&&"pointer-events-none opacity-40")})}>Rasmiylashtirish</Link>
        </div>
      </>}
    </SheetContent>
  </Sheet>;
}
