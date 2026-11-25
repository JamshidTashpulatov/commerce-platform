import type {ReactNode} from "react";
import {cn} from "@/lib/utils";
import {glyphFor,type Glyph} from "../../lib/storefront";
import {ToneImage} from "./tone-image";

export {imageSources,type ImageSources} from "../../lib/image-sources";
import {imageSources} from "../../lib/image-sources";

/**
 * A product photo, or a quiet line drawing when the product has no image yet.
 * "cover": the photo fills its frame (the product gallery sizes the frame to
 * the photo, so nothing is cut). "blend": for fixed tiles and cards, the whole
 * product stays visible; the tile takes the studio background's colour.
 * Uploaded marketing photos always cover. Transparent cut-outs are shown
 * whole, since there is no background to fill.
 */
export function ProductVisual({image,name,category,className,priority=false,sizes="(min-width:1069px) 50vw, 100vw",cutoutPadding=true,fit="cover"}:{
  image:string|null;name:string;category:string;className?:string;priority?:boolean;sizes?:string;cutoutPadding?:boolean;fit?:"cover"|"blend";
}){
  if(image){
    const s=imageSources(image);
    const studio=s.ratio!==null&&!s.alpha;
    const mode=s.alpha||(fit==="blend"&&studio)?"object-contain":"object-cover";
    const attrs={className:cn("block size-full transition-opacity",mode,s.alpha&&cutoutPadding&&"p-[5%]",className),
      src:s.src,srcSet:s.srcSet,sizes:s.srcSet?sizes:undefined,alt:name,referrerPolicy:"no-referrer" as const,
      loading:priority?"eager" as const:"lazy" as const,fetchPriority:priority?"high" as const:"auto" as const,decoding:"async" as const};
    // Studio shots: the surrounding [data-tone] container takes the photo's background colour.
    return studio?<ToneImage {...attrs}/>:<img {...attrs}/>;
  }
  return <div className={cn("flex size-full items-center justify-center bg-linear-to-b from-[#fafafc] to-[#ececf0] text-[#b0b0b6]",className)}
    role="img" aria-label={name+". Rasm tez orada qo‘shiladi"}>
    <GlyphArt glyph={glyphFor(name,category)}/>
  </div>;
}

function GlyphArt({glyph}:{glyph:Glyph}){
  const p={fill:"none",stroke:"currentColor",strokeWidth:2.2,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
  const art:Record<Glyph,ReactNode>={
    phone:<><rect x="80" y="20" width="80" height="160" rx="16" {...p}/><rect x="104" y="30" width="32" height="8" rx="4" {...p}/></>,
    tablet:<><rect x="52" y="24" width="136" height="152" rx="14" {...p}/><circle cx="120" cy="34" r="2" fill="currentColor"/></>,
    laptop:<><rect x="50" y="40" width="140" height="92" rx="8" {...p}/><path d="M30 146h180l-8 10H38z" {...p}/></>,
    desktop:<><rect x="40" y="30" width="160" height="104" rx="8" {...p}/><path d="M104 134l-6 30h44l-6-30M90 164h60" {...p}/></>,
    watch:<><rect x="84" y="56" width="72" height="88" rx="20" {...p}/><path d="M96 56l4-30h40l4 30M96 144l4 30h40l4-30M156 92h6" {...p}/></>,
    earbuds:<><path d="M92 60a18 18 0 1 1-6 34l4 64a6 6 0 0 1-12 0l-4-70" {...p}/><path d="M148 60a18 18 0 1 0 6 34l-4 64a6 6 0 0 0 12 0l4-70" {...p}/></>,
    headset:<><path d="M44 104c0-26 30-40 76-40s76 14 76 40-18 34-40 34c-16 0-22-14-36-14s-20 14-36 14c-22 0-40-8-40-34z" {...p}/><path d="M196 100h12M32 100h12" {...p}/></>,
    speaker:<><rect x="82" y="44" width="76" height="120" rx="34" {...p}/><ellipse cx="120" cy="56" rx="22" ry="6" {...p}/></>,
    keyboard:<><rect x="28" y="70" width="184" height="64" rx="10" {...p}/><path d="M46 88h8M66 88h8M86 88h8M106 88h8M126 88h8M146 88h8M166 88h8M186 88h8M50 104h8M70 104h8M90 104h8M110 104h8M130 104h8M150 104h8M170 104h8M76 120h88" {...p}/></>,
    mouse:<><path d="M120 40c-24 0-34 16-34 40v40c0 24 10 40 34 40s34-16 34-40V80c0-24-10-40-34-40z" {...p}/></>,
    trackpad:<><rect x="50" y="46" width="140" height="108" rx="14" {...p}/></>,
    card:<><rect x="44" y="56" width="152" height="96" rx="12" {...p}/><path d="M120 56v96M44 92h152M120 92c-10-20-34-18-30-2 2 8 18 4 30 2zm0 0c10-20 34-18 30-2-2 8-18 4-30 2z" {...p}/></>,
    box:<><path d="M120 34l70 30v72l-70 30-70-30V64z" {...p}/><path d="M50 64l70 30 70-30M120 94v72" {...p}/></>,
  };
  return <svg viewBox="0 0 240 200" className="h-auto w-[min(46%,240px)]" aria-hidden="true">{art[glyph]}</svg>;
}
