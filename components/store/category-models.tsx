import Link from "next/link";
import type {CategoryModel} from "../../lib/server/storefront";
import {productHref} from "../../lib/storefront";
import {ProductVisual} from "./product-visual";

/** A row of the category's models under the catalog heading: small photo and name, each a link to the model. */
export function CategoryModels({category,models}:{category:string;models:CategoryModel[]}){
  return <nav aria-label={category+" modellari"} className="sf-no-scrollbar -mx-4 overflow-x-auto px-4 tablet:-mx-[22px] tablet:px-[22px]">
    <ul className="flex w-max gap-1 pt-1 pb-2 tablet:gap-3">
      {models.map(m=><li key={m.id}>
        <Link href={productHref(m.id)} className="group flex w-[92px] flex-col items-center gap-2.5 rounded-xl px-1 pt-1 pb-1.5 text-center focus-visible:outline-2 focus-visible:outline-sf-blue tablet:w-[104px]">
          <span data-tone className="relative h-[54px] w-[72px] overflow-hidden rounded-lg">
            <ProductVisual image={m.image} name={m.name} category={category} fit="blend" cutoutPadding={false} sizes="72px"
              className="absolute inset-0 transition-transform duration-200 ease-sf motion-safe:group-hover:scale-[1.04]"/>
          </span>
          <span className="text-xs leading-[1.33] tracking-[-0.01em] text-sf-ink group-hover:text-sf-blue">{m.name}</span>
        </Link>
      </li>)}
    </ul>
  </nav>;
}
