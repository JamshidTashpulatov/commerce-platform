import type {Metadata} from "next";
import Link from "next/link";
import {CompareView,type CompareProduct,type Sibling} from "../../../components/store/compare-view";
import {pill,wrap} from "../../../components/store/bits";
import {getProduct,listProducts} from "../../../lib/server/storefront";
import {pageMeta} from "../../../lib/server/seo";
import {bySize,isColorGroup} from "../../../lib/storefront";

export const dynamic="force-dynamic";
export const metadata:Metadata=pageMeta({title:"Solishtirish",path:"/compare",index:false,description:"Modellarni narx, rang, variant va mavjudlik bo‘yicha yonma-yon solishtiring."});

const MAX=3;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ComparePage({searchParams}:{searchParams:Promise<{ids?:string}>}){
  const ids=[...new Set(((await searchParams).ids??"").split(",").map(s=>s.trim().toLowerCase()).filter(s=>uuid.test(s)))].slice(0,MAX);
  let products:CompareProduct[]=[];let siblings:Sibling[]=[];let failed=false;
  try{
    const details=(await Promise.all(ids.map(id=>getProduct(id)))).filter(p=>p!==null);
    products=details.map(p=>{
      const prices=p.skus.map(s=>BigInt(s.price));
      const colorGroup=p.groups.find(g=>isColorGroup(g.name));
      return {
        id:p.id,name:p.name,category:p.category,image:p.image,
        fromPrice:prices.reduce((a,b)=>b<a?b:a).toString(),toPrice:prices.reduce((a,b)=>b>a?b:a).toString(),
        inStock:p.inStock,inStockCount:p.skus.filter(s=>s.inStock).length,variants:p.skus.length,
        colors:colorGroup?colorGroup.values.filter(v=>p.skus.some(s=>s.options[colorGroup.name]===v.label)).map(v=>({label:v.label,image:v.imageUrl})):[],
        groups:Object.fromEntries(p.groups.filter(g=>!isColorGroup(g.name)).map(g=>[g.name,g.values.filter(v=>p.skus.some(s=>s.options[g.name]===v.label)).map(v=>v.label)]).map(([n,v])=>[n,bySize(v as string[])])),
      };
    });
    // Suggest the closest siblings: same category, nearest starting price first.
    const category=products[0]?.category;
    if(category){
      const ref=BigInt(products[0].fromPrice);
      const dist=(p:string)=>{const d=BigInt(p)-ref;return d<BigInt(0)?-d:d;};
      siblings=(await listProducts()).filter(p=>p.category===category&&!ids.includes(p.id))
        .sort((a,b)=>{const x=dist(a.fromPrice),y=dist(b.fromPrice);return x<y?-1:x>y?1:0;})
        .map(p=>({id:p.id,name:p.name,category:p.category,image:p.image,fromPrice:p.fromPrice}));
    }
  }catch{failed=true;}

  if(failed)return <section className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 py-20 text-center">
    <h1 className="text-[40px] leading-[1.1] font-semibold">Solishtirish vaqtincha ochilmadi.</h1>
    <p className="mb-3 text-[19px] text-sf-ink-2">Birozdan keyin sahifani yangilang.</p>
    <Link className={pill()} href="/catalog">Katalogga qaytish</Link>
  </section>;

  return <div className={wrap+" pb-24"}><CompareView products={products} siblings={siblings} max={MAX}/></div>;
}
