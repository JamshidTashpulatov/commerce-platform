// Shared, client-safe storefront helpers.

export const STORE_NAME="Malika Tech";
export const TELEGRAM_BOT="malika_tech_store_bot";
export const TELEGRAM_URL="https://t.me/"+TELEGRAM_BOT;

export function soum(value:string|bigint|number){
  // Grouped by hand: browsers disagree on uz-UZ separators, and server and
  // client output must match.
  try{return BigInt(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g,"\u00a0")+"\u00a0so‘m";}catch{return "—";}
}
/** "9 987 500 so‘mdan" — a starting price. */
export const fromSoum=(value:string)=>soum(value)+"dan";

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

