"use client";
import {useState} from "react";
import {CheckIcon,PlusIcon} from "lucide-react";
import {cn} from "@/lib/utils";
import {COMPARE_MAX,compareStore,toggleCompare,type CompareItem} from "../../lib/compare-store";

/** "Solishtirish" checkbox-style control for catalog cards and the product page. */
export function CompareToggle({item,className,size="sm"}:{item:CompareItem;className?:string;size?:"sm"|"md"}){
  const list=compareStore.use();
  const on=list.some(i=>i.id===item.id);
  const [notice,setNotice]=useState<null|"full"|"other-category">(null);
  const click=()=>{const r=toggleCompare(item);setNotice(r==="full"||r==="other-category"?r:null);};
  return <div className={cn("relative",className)}>
    <button type="button" aria-pressed={on} onClick={click}
      className={cn("inline-flex cursor-pointer items-center gap-2 rounded-full text-sf-ink transition-colors hover:text-sf-blue",size==="sm"?"text-xs":"text-sm")}>
      <span aria-hidden="true" className={cn("inline-flex items-center justify-center rounded-[5px] border transition-colors",size==="sm"?"size-4":"size-[18px]",
        on?"border-sf-blue bg-sf-blue text-white":"border-sf-ink-3 bg-white")}>{on?<CheckIcon className="size-3" strokeWidth={3}/>:<PlusIcon className="size-3 text-sf-ink-3" strokeWidth={2.5}/>}</span>
      {on?"Solishtirishda":"Solishtirish"}
    </button>
    {notice&&<div role="alert" className="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-xl bg-sf-ink p-3 text-xs leading-[1.45] text-white shadow-lg">
      {notice==="full"?`Bir vaqtda ${COMPARE_MAX} tagacha mahsulot solishtiriladi. Avval bittasini olib tashlang.`
        :<>Ro‘yxatda {list[0]?.category} mahsulotlari bor. Bir turkum ichida solishtirish aniqroq.
          <span className="mt-2 flex gap-3">
            <button type="button" className="cursor-pointer font-semibold text-sf-blue-dark" onClick={()=>{toggleCompare(item,true);setNotice(null);}}>Yangi ro‘yxat boshlash</button>
            <button type="button" className="cursor-pointer text-white/70" onClick={()=>setNotice(null)}>Bekor qilish</button>
          </span></>}
    </div>}
  </div>;
}
