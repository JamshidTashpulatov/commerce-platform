"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {AlertTriangleIcon,XIcon,ZapIcon} from "lucide-react";
import {Dialog,DialogClose,DialogContent,DialogDescription,DialogTitle} from "@/components/ui/dialog";
import {Skeleton} from "@/components/ui/skeleton";
import {useQuote} from "../../lib/use-cart-quote";

import {ProductVisual} from "./product-visual";
import {CheckoutForm,type TelegramLogin} from "./checkout-form";
import {pill} from "./bits";
import {formatMoney} from "../../lib/money";

/**
 * "Bir bosishda xarid": orders the selected variant directly, leaving the cart
 * alone. One confirmation sheet shows the price re-read from the server; a known
 * customer only presses once more there.
 */
export function OneClick({variantId,productName,options,enabled,telegram,disabledReason}:{
  variantId:string;productName:string;options:string;enabled:boolean;telegram:TelegramLogin;disabledReason?:string|null;
}){
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const {quotes,loading,error}=useQuote([{variantId,quantity:1}],open);
  const q=quotes[0];
  const reason=disabledReason??(!enabled?"Saytdan buyurtma hali yoqilmagan. Telegram orqali yozing.":null);

  return <>
    <button type="button" className={pill({tone:"ghost",className:"w-full gap-2"})} disabled={!!reason} onClick={()=>setOpen(true)} aria-describedby={reason?"one-click-reason":undefined}>
      <ZapIcon className="size-[18px]" aria-hidden="true"/>Bir bosishda xarid
    </button>
    {reason&&<p id="one-click-reason" className="-mt-1 text-center text-xs text-sf-ink-3">{reason}</p>}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent data-lenis-prevent showCloseButton={false} className="top-auto bottom-0 left-0 max-h-[92dvh] w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-t-[22px] rounded-b-none bg-white p-6 font-sf text-sf-ink sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-w-[440px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[22px]">
        <DialogClose aria-label="Yopish" className="absolute top-4 right-4 inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-sf-alt text-sf-ink-2 hover:text-sf-ink"><XIcon className="size-4"/></DialogClose>
        <DialogTitle className="text-[21px] font-semibold">Bir bosishda xarid</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-sf-ink-2">Savat o‘zgarmaydi. Sotuvchi qo‘ng‘iroq qilib tasdiqlaydi.</DialogDescription>
        <div className="mt-5 flex items-center gap-4 rounded-xl bg-sf-alt p-3">
          <div data-tone className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-white">
            {q?<ProductVisual image={q.image} name={q.name} category={q.category} fit="blend" sizes="64px" cutoutPadding={false} className="absolute inset-0"/>:<Skeleton className="size-full"/>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{productName}</p>
            {options&&<p className="truncate text-sm text-sf-ink-2">{options}</p>}
            <p className="mt-0.5 font-semibold tabular-nums">{q?formatMoney(q.unitPrice):loading?"…":"—"}</p>
          </div>
        </div>
        {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        {q&&!q.available&&<p role="alert" className="mt-3 flex items-start gap-1.5 text-sm text-red-700"><AlertTriangleIcon className="mt-0.5 size-4 shrink-0"/>Bu variant endi sotuvda yo‘q.</p>}
        {q&&q.available&&!q.inStock&&<p className="mt-3 text-xs text-sf-ink-2">Hozir omborda yo‘q: buyurtma asosida, sotuvchi muddatini aytadi.</p>}
        <div className="mt-6">
          {q?.available?<CheckoutForm channel="one_click" compact telegram={telegram} submitLabel="Buyurtma berish"
            lines={[{variantId,quantity:1,expectedPrice:q.unitPrice}]} onSuccess={ref=>{setOpen(false);router.push("/checkout/done?ref="+ref);}}/>
            :loading?<Skeleton className="h-40 rounded-xl"/>:null}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
