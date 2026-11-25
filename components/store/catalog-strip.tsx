import Link from "next/link";
import {cn} from "@/lib/utils";
import {ProductVisual} from "./product-visual";

export type StripItem={key:string;href:string;name:string;image:string|null;category:string;selected?:boolean};

/**
 * The row under the catalog search: categories on the full catalog, the
 * category's model families inside a category, where it filters the grid.
 * Small photo and name, each a link; items size to their label.
 */
export function CatalogStrip({label,items}:{label:string;items:StripItem[]}){
  const filtering=items.some(i=>i.selected);
  return <nav aria-label={label} className="sf-no-scrollbar -mx-4 overflow-x-auto px-4 tablet:-mx-[22px] tablet:px-[22px]">
    <ul className="flex w-max items-start gap-6 tablet:gap-9">
      {items.map(m=><li key={m.key}>
        <Link href={m.href} scroll={false} aria-current={m.selected?"true":undefined}
          className={cn("group flex max-w-[104px] min-w-[72px] flex-col items-center gap-2.5 rounded-lg pb-1.5 text-center transition-opacity duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sf-blue",
            filtering&&!m.selected&&"opacity-55 hover:opacity-100")}>
          <span data-tone className="relative h-[54px] w-[72px] shrink-0 overflow-hidden rounded-lg">
            <ProductVisual image={m.image} name={m.name} category={m.category} fit="blend" cutoutPadding={false} sizes="72px"
              className="absolute inset-0 transition-transform duration-200 ease-sf motion-safe:group-hover:scale-[1.04]"/>
          </span>
          <span className={cn("text-xs leading-[1.33] tracking-[-0.01em] text-sf-ink group-hover:text-sf-blue",m.selected&&"font-semibold")}>{m.name}</span>
        </Link>
      </li>)}
    </ul>
  </nav>;
}
