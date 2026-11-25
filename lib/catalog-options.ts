export type OptionValue={label:string;imageUrl:string|null};
export type OptionGroup={name:string;affectsPrice:boolean;values:OptionValue[]};
export type OptionSelection=Record<string,string>;
const safeLabel=(s:unknown,max:number):s is string=>typeof s==="string"&&s.trim()===s&&s.length>0&&s.length<=max&&!["__proto__","constructor","prototype"].includes(s.toLowerCase());
export function validGroups(raw:unknown,imageAllowed:(url:string)=>boolean):raw is OptionGroup[]{
 if(!Array.isArray(raw)||raw.length>8)return false;
 const names=new Set<string>();
 for(const g of raw){
 if(!g||typeof g!=="object"||!safeLabel(g.name,60)||names.has(g.name.toLowerCase())||typeof g.affectsPrice!=="boolean"||!Array.isArray(g.values)||g.values.length<1||g.values.length>30)return false;
 names.add(g.name.toLowerCase());
 const values=new Set<string>();
 for(const v of g.values){
 if(!v||typeof v!=="object"||!safeLabel(v.label,80)||values.has(v.label.toLowerCase())||(v.imageUrl!==null&&(typeof v.imageUrl!=="string"||!imageAllowed(v.imageUrl))))return false;
 values.add(v.label.toLowerCase());
 }
 }
 return true;
}
export function validSelection(groups:OptionGroup[],raw:unknown):raw is OptionSelection{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return false;
 const entries=Object.entries(raw);
 return entries.length===groups.length&&groups.every(g=>Object.hasOwn(raw,g.name)&&g.values.some(v=>v.label===(raw as OptionSelection)[g.name]));
}
export function variantImage(groups:OptionGroup[],selection:OptionSelection,override:string|null,fallback:string|null):string|null{
 if(override)return override;
 for(const group of groups){const value=group.values.find(v=>v.label===selection[group.name]);if(value?.imageUrl)return value.imageUrl;}
 return fallback;
}
export function matchingVariants<T extends {option_values:OptionSelection}>(variants:T[],selection:OptionSelection){
 return variants.filter(v=>Object.entries(selection).every(([k,value])=>v.option_values[k]===value));
}
