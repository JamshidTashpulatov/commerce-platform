// The store's currency, defined once for the storefront and the staff workspace.
//
// Amounts are whole US dollars, kept as integers (strings or bigint on the way
// through, so large sums never lose precision). There are no cents.
//
// Legacy naming: database columns and API fields still end in `_uzs`
// (`price_uzs`, `unit_price_uzs`, `amount_uzs`, `total_uzs`, ...). That suffix is
// historical. The values are whole US dollars. Renaming them is planned as a
// separate change once the open branches have merged (docs/NEXT-STEPS.md).
// All arithmetic is integer and unit-agnostic, so nothing else changes.

export const CURRENCY={code:"USD",symbol:"$",name:"AQSh dollari"} as const;

/** The largest amount the inputs accept: $999,999,999. */
export const MONEY_MAX_DIGITS=9;

const group=(digits:string)=>digits.replace(/\B(?=(\d{3})+(?!\d))/g,",");

/**
 * "$1,250": whole dollars, comma thousands separator, no decimals.
 * Negative amounts read "−$1,250". Anything that is not an integer gives "—".
 * Grouped by hand so server and browser output always match.
 */
export function formatMoney(value:string|bigint|number|null|undefined):string{
  if(value===null||value===undefined||value==="")return "—";
  let n:bigint;
  try{
    if(typeof value==="number"&&!Number.isSafeInteger(value))return "—";
    n=BigInt(value);
  }catch{return "—";}
  const negative=n<BigInt(0);
  return (negative?"−":"")+CURRENCY.symbol+group((negative?-n:n).toString());
}

/** "$1,250 dan": a starting price. */
export const formatFrom=(value:string|bigint|number)=>formatMoney(value)+" dan";

/**
 * Reads what a person typed as a whole-dollar amount: "$1,250", "1 250", "1250"
 * and "1250.00" all give "1250". Cents other than ".00", letters, more than
 * MONEY_MAX_DIGITS digits and negative values give null. Zero gives null
 * unless allowZero is set. Returns a digit string, the form the APIs expect.
 */
export function parseMoney(input:string,{allowZero=false}:{allowZero?:boolean}={}):string|null{
  const s=input.trim().replace(/^\$/,"").replace(/[\s  ,]/g,"").replace(/\.0{1,2}$/,"").replace(/^\$/,"");
  if(!/^\d+$/.test(s))return null;
  const digits=s.replace(/^0+(?=\d)/,"");
  if(digits.length>MONEY_MAX_DIGITS)return null;
  if(digits==="0"&&!allowZero)return null;
  return digits;
}

/** Digits only, for an input that shows thousands separators while typing. */
export const groupMoneyDigits=(digits:string)=>group(digits.replace(/\D/g,"").replace(/^0+(?=\d)/,""));
