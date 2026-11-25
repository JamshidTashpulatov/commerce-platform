import Link from "next/link";
import {ProductVisual} from "./product-visual";

export type StripItem={key:string;href:string;name:string;image:string|null;category:string};

/**
 * The row under the catalog search: categories on the full catalog, the
 * category's models inside a category. Small photo and name, each a link.
 */
export function CatalogStrip({label,items}:{label:string;items:StripItem[]}){
  return <nav aria-label={label} className="sf-no-scrollbar -mx-4 overflow-x-auto px-4 tablet:-mx-[22px] tablet:px-[22px]">
    <ul className="flex w-max items-start gap-6 tablet:gap-9">
      {items.map(m=><li key={m.key}>
        <Link href={m.href} className="group flex max-w-[104px] min-w-[72px] flex-col items-center gap-2.5 rounded-lg pb-1.5 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sf-blue">
          <span data-tone className="relative h-[54px] w-[72px] shrink-0 overflow-hidden rounded-lg">
            <ProductVisual image={m.image} name={m.name} category={m.category} fit="blend" cutoutPadding={false} sizes="72px"
              className="absolute inset-0 transition-transform duration-200 ease-sf motion-safe:group-hover:scale-[1.04]"/>
          </span>
          <span className="text-xs leading-[1.33] tracking-[-0.01em] text-sf-ink group-hover:text-sf-blue">{m.name}</span>
        </Link>
      </li>)}
    </ul>
  </nav>;
}
