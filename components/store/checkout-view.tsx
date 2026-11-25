"use client";
import {useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ShoppingBagIcon} from "lucide-react";
import {Empty,EmptyContent,EmptyDescription,EmptyHeader,EmptyMedia,EmptyTitle} from "@/components/ui/empty";
import {cartStore} from "../../lib/cart-store";
import {useQuote,type Quote} from "../../lib/use-cart-quote";
import {TELEGRAM_URL} from "../../lib/storefront";
import {CartLines,summarize} from "./cart-sheet";
import {CheckoutForm,type TelegramLogin} from "./checkout-form";
import {pill} from "./bits";
import {formatMoney} from "../../lib/money";

export function CheckoutView({enabled,telegram}:{enabled:boolean;telegram:TelegramLogin}){
  const router=useRouter();
  const lines=cartStore.use();
  const {quotes,loading}=useQuote(lines);
  const {total,payable,unavailable}=summarize(lines,quotes);
  const [copied,setCopied]=useState(false);

  // When the server reports new prices, show them as seen so the customer can confirm and resend.
  const applyPrices=(fresh:Quote[])=>cartStore.set(list=>list.map(l=>{const q=fresh.find(x=>x.variantId===l.variantId);return q?.available?{...l,seenPrice:q.unitPrice}:l;}));
  const done=(reference:string)=>{
    const sent=new Set(payable.map(r=>r.line.variantId));
    cartStore.set(list=>list.filter(l=>!sent.has(l.variantId)));
    router.push("/checkout/done?ref="+reference);
  };
  const orderLines=payable.map(r=>({variantId:r.line.variantId,quantity:r.line.quantity,expectedPrice:r.quote!.unitPrice}));
  const text=payable.map(r=>`${r.quote!.name}${r.quote!.options?" ("+r.quote!.options+")":""} × ${r.line.quantity}: ${formatMoney(BigInt(r.quote!.unitPrice)*BigInt(r.line.quantity))}`).join("\n")+`\nJami: ${formatMoney(total)}`;

  if(!lines.length)return <div className="pt-16">
    <Empty className="rounded-[18px] bg-sf-alt py-16">
      <EmptyHeader><EmptyMedia variant="icon"><ShoppingBagIcon/></EmptyMedia>
        <EmptyTitle className="text-[28px] leading-[1.14] font-semibold">Savatingiz bo‘sh.</EmptyTitle>
        <EmptyDescription className="text-[17px] text-sf-ink-2">Rasmiylashtirish uchun avval mahsulot tanlang.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent><Link className={pill()} href="/catalog">Katalogga o‘tish</Link></EmptyContent>
    </Empty>
  </div>;

  return <>
    <header className="pt-10 pb-8 tablet:pt-16 tablet:pb-12">
      <h1 className="text-[40px] leading-[1.1] font-semibold tablet:text-5xl tablet:leading-[1.08]">Rasmiylashtirish.</h1>
      <p className="mt-2 text-[19px] text-sf-ink-2">Ism va telefon raqamingizni qoldiring. Sotuvchi qo‘ng‘iroq qilib, buyurtmani tasdiqlaydi.</p>
    </header>
    <div className="grid items-start gap-12 desktop:grid-cols-[minmax(0,1fr)_400px] desktop:gap-16">
      <section aria-labelledby="contact-title" className="order-2 desktop:order-1">
        <h2 id="contact-title" className="mb-6 text-2xl font-semibold">Aloqa ma’lumotlari</h2>
        {enabled?<CheckoutForm channel="cart" lines={orderLines} telegram={telegram} submitLabel="So‘rov yuborish" onSuccess={done} onPriceChange={applyPrices}/>
        :<div className="flex flex-col gap-4 rounded-[18px] bg-sf-alt p-6">
          <p className="font-semibold">Saytdan buyurtma qabul qilish hali yoqilmagan.</p>
          <p className="text-sm text-sf-ink-2">Savatdagi ro‘yxatni nusxa olib, do‘konning Telegram botiga yuboring. Sotuvchi shu yerda javob beradi.</p>
          <div className="flex flex-col gap-3 tablet:flex-row">
            <button type="button" className={pill({tone:"ghost",className:"flex-1"})} onClick={async()=>{try{await navigator.clipboard.writeText(text);setCopied(true);}catch{setCopied(false);}}}>{copied?"Nusxa olindi":"Ro‘yxatni nusxalash"}</button>
            <a className={pill({className:"flex-1"})} href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">Telegram’ni ochish</a>
          </div>
        </div>}
      </section>
      <aside aria-labelledby="summary-title" className="order-1 rounded-[18px] bg-sf-alt p-6 desktop:sticky desktop:top-[76px] desktop:order-2">
        <h2 id="summary-title" className="text-[21px] font-semibold">Buyurtma</h2>
        <CartLines lines={lines} quotes={quotes} loading={loading}/>
        <div className="mt-2 border-t border-sf-line pt-4">
          {unavailable>0&&<p className="mb-2 text-xs text-amber-800">Sotuvda yo‘q mahsulotlar so‘rovga qo‘shilmaydi.</p>}
          <div className="flex items-baseline justify-between"><span className="text-sf-ink-2">Jami</span><span className="text-[24px] font-semibold tabular-nums">{loading&&!quotes.length?"…":formatMoney(total)}</span></div>
          <p className="mt-1 text-xs text-sf-ink-3">Yetkazib berish narxi yo‘q. Onlayn to‘lov yo‘q.</p>
          {payable.length>1&&<p className="mt-3 text-xs leading-[1.5] text-sf-ink-3">Har bir mahsulot alohida so‘rov sifatida yoziladi, hammasi bitta raqam ostida.</p>}
        </div>
      </aside>
    </div>
  </>;
}
