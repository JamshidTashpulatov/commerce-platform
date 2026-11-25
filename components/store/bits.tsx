import {cn} from "@/lib/utils";
import {buttonVariants} from "@/components/ui/button";

/** Apple-style pill on top of the shadcn button: blue fill or blue outline. */
export function pill({tone="primary",size="md",dark=false,className}:{tone?:"primary"|"ghost";size?:"sm"|"md";dark?:boolean;className?:string}={}){
  return cn(buttonVariants({variant:"default"}),
    "rounded-full border font-normal tracking-[-0.022em] transition-[background-color,color,border-color,transform] duration-200 ease-sf active:scale-[0.97] active:translate-y-0",
    size==="md"?"h-11 px-[22px] text-[17px]":"h-9 px-4 text-sm",
    tone==="primary"?"border-sf-blue bg-sf-blue text-white hover:border-sf-blue-hover hover:bg-sf-blue-hover"
      :dark?"border-sf-blue-dark bg-transparent text-sf-blue-dark hover:bg-sf-blue-dark hover:text-white"
      :"border-sf-blue bg-transparent text-sf-blue hover:bg-sf-blue hover:text-white",
    className);
}

/** Shown only when a product is unavailable. Pass `always` where availability itself is the point, as in the comparison table. */
export function Availability({inStock,className,long=false,always=false}:{inStock:boolean;className?:string;long?:boolean;always?:boolean}){
  if(inStock&&!always)return null;
  return <p className={cn("flex items-start gap-1.5 text-xs leading-4",inStock?"text-sf-green":"text-sf-ink-2",className)}>
    <span aria-hidden="true" className={cn("mt-[5px] size-1.5 shrink-0 rounded-full",inStock?"bg-sf-green":"bg-sf-ink-3")}/>
    <span>{inStock?"Mavjud":(long?"Hozircha mavjud emas. Kelishini sotuvchidan so‘rang.":"Hozircha mavjud emas")}</span>
  </p>;
}

export const eyebrow="text-xs font-semibold leading-4 tracking-[-0.01em] text-sf-ink-2";
export const wrap="mx-auto w-full max-w-[1024px] px-4 tablet:px-[22px]";
