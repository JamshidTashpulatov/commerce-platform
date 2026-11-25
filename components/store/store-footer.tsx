import Link from "next/link";
import {STORE_NAME,TELEGRAM_URL,catalogHref} from "../../lib/storefront";

export function StoreFooter({categories}:{categories:string[]}){
  const year=new Date().getFullYear();
  return <footer className="sf-footer">
    <div className="sf-footer-inner">
      <div className="sf-footer-notes">
        <p>Saytdagi narxlar va mavjudlik ma’lumot uchun. Yakuniy narx va yetkazib berish sotuvchi bilan Telegram orqali kelishiladi. Onlayn to‘lov qabul qilinmaydi.</p>
        <p>{STORE_NAME} mustaqil do‘kon. Apple, iPhone, iPad, Mac, Apple Watch, AirPods va Apple Vision Pro Apple Inc. kompaniyasining savdo belgilaridir. Do‘kon Apple Inc. vakili emas.</p>
      </div>
      <nav className="sf-footer-dir" aria-label="Sayt xaritasi">
        <div>
          <h3>Mahsulotlar</h3>
          <ul>{categories.map(c=><li key={c}><Link href={catalogHref(c)}>{c}</Link></li>)}</ul>
        </div>
        <div>
          <h3>Do‘kon</h3>
          <ul>
            <li><Link href="/catalog">Barcha mahsulotlar</Link></li>
            <li><Link href="/#buyurtma">Qanday buyurtma beriladi</Link></li>
            <li><a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">Telegram bot</a></li>
          </ul>
        </div>
        <div>
          <h3>Hamkorlar uchun</h3>
          <ul><li><Link href="/login">Xodimlar va investorlar kirishi</Link></li></ul>
        </div>
      </nav>
      <div className="sf-footer-legal">
        <p>© {year} {STORE_NAME}. Barcha huquqlar himoyalangan.</p>
        <p>O‘zbekiston</p>
      </div>
    </div>
  </footer>;
}
