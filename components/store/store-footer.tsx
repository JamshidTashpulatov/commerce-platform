import Link from "next/link";
import {Separator} from "@/components/ui/separator";
import {STORE_NAME,TELEGRAM_URL,catalogHref} from "../../lib/storefront";
import {wrap} from "./bits";

const link="text-black/70 hover:text-black/90 hover:underline";

export function StoreFooter({categories}:{categories:string[]}){
  const year=new Date().getFullYear();
  return <footer className="mt-auto bg-sf-alt text-xs leading-4 tracking-[-0.01em] text-black/55">
    <div className={wrap+" py-5 pb-6"}>
      <div className="flex flex-col gap-2.5 pb-4">
        <p>Saytdagi narxlar va mavjudlik ma’lumot uchun. Buyurtmadan keyin sotuvchi qo‘ng‘iroq qilib, yakuniy narx va topshirishni kelishadi. Onlayn to‘lov qabul qilinmaydi.</p>
        <p>{STORE_NAME} mustaqil do‘kon. Apple, iPhone, iPad, Mac, Apple Watch, AirPods va Apple Vision Pro Apple Inc. kompaniyasining savdo belgilaridir. Do‘kon Apple Inc. vakili emas.</p>
      </div>
      <Separator className="bg-sf-line"/>
      <nav className="grid grid-cols-2 gap-x-4 gap-y-6 py-5 tablet:grid-cols-3" aria-label="Sayt xaritasi">
        <div>
          <h3 className="mb-2 font-semibold text-black/90">Mahsulotlar</h3>
          <ul className="flex flex-col gap-2">{categories.map(c=><li key={c}><Link className={link} href={catalogHref(c)}>{c}</Link></li>)}</ul>
        </div>
        <div>
          <h3 className="mb-2 font-semibold text-black/90">Do‘kon</h3>
          <ul className="flex flex-col gap-2">
            <li><Link className={link} href="/catalog">Barcha mahsulotlar</Link></li>
            <li><Link className={link} href="/#buyurtma">Qanday buyurtma beriladi</Link></li>
            <li><a className={link} href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">Telegram bot</a></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-2 font-semibold text-black/90">Hamkorlar uchun</h3>
          <ul><li><Link className={link} href="/login">Xodimlar va investorlar kirishi</Link></li></ul>
        </div>
      </nav>
      <Separator className="bg-sf-line"/>
      <div className="flex flex-wrap justify-between gap-2 pt-4">
        <p>© {year} {STORE_NAME}. Barcha huquqlar himoyalangan.</p>
        <p>O‘zbekiston</p>
      </div>
    </div>
  </footer>;
}
