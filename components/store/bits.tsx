export function Availability({inStock}:{inStock:boolean}){
  return <p className={"sf-stock"+(inStock?" is-in":"")}>{inStock?"Mavjud":"Hozircha mavjud emas"}</p>;
}
export function Chevron(){
  return <svg viewBox="0 0 8 14" width="7" height="12" aria-hidden="true"><path d="M1 1l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
