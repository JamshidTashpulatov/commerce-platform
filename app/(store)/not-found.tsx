import Link from "next/link";

export default function NotFound(){
  return <section className="sf-empty-page">
    <p className="sf-eyebrow">404</p>
    <h1>Bu sahifa topilmadi.</h1>
    <p>Mahsulot katalogdan olib tashlangan yoki havola noto‘g‘ri bo‘lishi mumkin.</p>
    <div className="sf-ctas"><Link className="sf-btn" href="/catalog">Katalogga o‘tish</Link><Link className="sf-btn sf-btn-ghost" href="/">Bosh sahifa</Link></div>
  </section>;
}
