import type {SVGProps} from "react";
import {BRAND_MARK_D,BRAND_MARK_ROTATIONS,BRAND_MARK_VIEWBOX} from "@/lib/brand-mark";

/**
 * The Techs logo. Inherits its colour (currentColor) and draws three explicit
 * paths instead of <use>, so several copies on one page never clash on ids.
 * Decorative by default; pass a `title` to make it a labelled image.
 */
export function BrandMark({title,...props}:SVGProps<SVGSVGElement>&{title?:string}){
  return <svg viewBox={BRAND_MARK_VIEWBOX} fill="currentColor" role={title?"img":undefined} aria-label={title} aria-hidden={title?undefined:true} {...props}>
    {BRAND_MARK_ROTATIONS.map(r=><path key={r} d={BRAND_MARK_D} transform={r?`rotate(${r} 256 256)`:undefined}/>)}
  </svg>;
}
