// Shared, client-safe storefront helpers.

/** The store's name, defined once. The admin side re-exports it from lib/brand.ts. */
export const STORE_NAME="Tech Store";
// The logo lives in lib/brand-mark.ts and components/brand-mark.tsx.
// The Telegram bot keeps its original handle; renaming the store does not change it.
export const TELEGRAM_BOT="malika_tech_store_bot";
export const TELEGRAM_URL="https://t.me/"+TELEGRAM_BOT;

// Prices are formatted by lib/money.ts (whole US dollars).

export const catalogHref=(category?:string)=>category?"/catalog?category="+encodeURIComponent(category):"/catalog";
export const productHref=(id:string)=>"/products/"+id;

const COLOR_GROUP=/^(rang|colou?r|tus|цвет)/i;
export const isColorGroup=(name:string)=>COLOR_GROUP.test(name.trim());

// Common colour names in Uzbek and English. Unknown names fall back to the
// option's own image or a neutral swatch.
const SWATCHES:[RegExp,string][]=[
  [/qora|black|midnight|space|graphite|obsidian|jet/i,"#2e2e30"],
  [/\boq\b|white|starlight|silver|kumush|cloud/i,"#f1f1ef"],
  [/titan|natural|desert|qum/i,"#c2b8a8"],
  [/to‘q ko‘k|navy|deep blue|ultramarine/i,"#2f3c5c"],
  [/ko‘k|kok|blue|sky|moviy|teal/i,"#9ec3e6"],
  [/pushti|pink|rose/i,"#f4c9d4"],
  [/yashil|green|sage|mint/i,"#b9d3b0"],
  [/to‘q sariq|orange|apelsin/i,"#f29a55"],
  [/sariq|yellow|gold|oltin/i,"#f2dc9b"],
  [/binafsha|purple|lavender|violet/i,"#cdbde6"],
  [/qizil|red/i,"#c8202f"],
  [/kulrang|gray|grey/i,"#9a9aa0"],
];
export function swatchColor(label:string){
  for(const [pattern,color] of SWATCHES)if(pattern.test(label))return color;
  return null;
}

export type Glyph="phone"|"tablet"|"laptop"|"desktop"|"watch"|"earbuds"|"headset"|"speaker"|"keyboard"|"mouse"|"trackpad"|"card"|"box";
export function glyphFor(name:string,category:string):Glyph{
  const n=name.toLowerCase(),c=category.toLowerCase();
  if(/keyboard|klaviatura/.test(n))return "keyboard";
  if(/trackpad/.test(n))return "trackpad";
  if(/mouse|sichqon/.test(n))return "mouse";
  if(/gift|sovg|card|karta/.test(n))return "card";
  if(/display|imac|studio|monitor/.test(n))return "desktop";
  if(/iphone|phone|telefon/.test(c+" "+n))return "phone";
  if(/ipad|tablet|planshet/.test(c))return "tablet";
  if(/mac|noutbuk|laptop/.test(c))return "laptop";
  if(/watch|soat/.test(c))return "watch";
  if(/airpods|quloq|audio/.test(c))return "earbuds";
  if(/vision/.test(c))return "headset";
  if(/home|uy|tv/.test(c))return "speaker";
  return "box";
}

const CATEGORY_ORDER=["mac","ipad","iphone","apple watch","vision","airpods","home","aksessuarlar"];
/** Category order used in the nav, the home page and the catalog filter. */
export function sortCategories(names:string[]){
  const rank=(n:string)=>{const i=CATEGORY_ORDER.indexOf(n.toLowerCase());return i<0?CATEGORY_ORDER.length:i;};
  return [...names].sort((a,b)=>rank(a)-rank(b)||a.localeCompare(b,"uz"));
}


export type DescriptionParts={body:string;config:{name:string;values:string}[];demoNote:string|null};
/**
 * Catalog descriptions end with an optional "Konfiguratsiya: Rang — A, B. Xotira — C."
 * listing and a demo notice. The storefront shows the listing only when there are
 * no option pickers saying the same thing, and the notice as a separate small note.
 */
export function splitDescription(text:string):DescriptionParts{
  let rest=text.trim();
  let demoNote:string|null=null;
  const demo=/\s*Demo mahsulot\b[\s\S]*$/i.exec(rest);
  if(demo){
    demoNote=demo[0].trim().replace(/^Demo mahsulot\s*[·.]\s*/i,"").replace(/^./,c=>c.toUpperCase());
    rest=rest.slice(0,demo.index).trim();
  }
  const config:{name:string;values:string}[]=[];
  const cfg=/\s*Konfiguratsiya:\s*([\s\S]*)$/i.exec(rest);
  if(cfg){
    for(const part of cfg[1].split(/\.\s+(?=[^.]+—)/)){
      const [name,...values]=part.replace(/\.$/,"").split("—");
      if(name&&values.length)config.push({name:name.trim(),values:values.join("—").trim()});
    }
    rest=rest.slice(0,cfg.index).trim();
  }
  return {body:rest,config,demoNote:demoNote?(demoNote.endsWith(".")?demoNote:demoNote+"."):null};
}

// "256 GB" before "1 TB": capacities sort by size, other values keep catalog order.
const capacity=(v:string)=>{const m=/^(\d+(?:[.,]\d+)?)\s*(GB|TB)\b/i.exec(v.trim());return m?parseFloat(m[1].replace(",","."))*(m[2].toUpperCase()==="TB"?1024:1):null;};
export function bySize<T>(values:T[],label:(v:T)=>string=(v=>String(v))):T[]{
  return values.every(v=>capacity(label(v))!==null)?[...values].sort((a,b)=>capacity(label(a))!-capacity(label(b))!):values;
}

export const TITLE_TEMPLATE="%s. "+STORE_NAME;
export const STORE_TAGLINE="Apple texnikasi do‘koni";
export const STORE_DESCRIPTION="iPhone, iPad, Mac, Apple Watch, AirPods va aksessuarlar. Narxlar dollarda, buyurtmani sotuvchi qo‘ng‘iroq qilib tasdiqlaydi.";
