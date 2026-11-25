import Link from "next/link";
import {pill,eyebrow} from "../../components/store/bits";

export default function NotFound(){
  return <section className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 py-20 text-center">
    <p className={eyebrow}>404</p>
    <h1 className="text-[40px] leading-[1.1] font-semibold">Bu sahifa topilmadi.</h1>
    <p className="mb-3 max-w-[520px] text-[19px] text-sf-ink-2">Mahsulot katalogdan olib tashlangan yoki havola noto‘g‘ri bo‘lishi mumkin.</p>
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-3"><Link className={pill()} href="/catalog">Katalogga o‘tish</Link><Link className={pill({tone:"ghost"})} href="/">Bosh sahifa</Link></div>
  </section>;
}
