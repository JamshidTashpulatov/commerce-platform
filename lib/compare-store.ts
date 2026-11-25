"use client";
import {createLocalStore} from "./local-store";

export const COMPARE_MAX=3;
export type CompareItem={id:string;name:string;category:string;image:string|null};
const isItem=(v:unknown):v is CompareItem=>!!v&&typeof v==="object"&&typeof (v as CompareItem).id==="string"&&typeof (v as CompareItem).name==="string"&&typeof (v as CompareItem).category==="string";
export const compareStore=createLocalStore<CompareItem[]>("sf-compare-v1",[],(v):v is CompareItem[]=>Array.isArray(v)&&v.length<=COMPARE_MAX&&v.every(isItem));

export type AddResult="added"|"removed"|"full"|"other-category";
/** Add or remove a product. Comparisons stay within one category unless the caller replaces the list. */
export function toggleCompare(item:CompareItem,replace=false):AddResult{
  const list=compareStore.get();
  if(list.some(i=>i.id===item.id)){compareStore.set(list.filter(i=>i.id!==item.id));return "removed";}
  if(replace){compareStore.set([item]);return "added";}
  if(list.length&&list[0].category!==item.category)return "other-category";
  if(list.length>=COMPARE_MAX)return "full";
  compareStore.set([...list,item]);
  return "added";
}
export const compareHref=(ids:string[])=>"/compare?ids="+ids.join(",");
