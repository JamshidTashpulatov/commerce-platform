"use client";
import {createLocalStore} from "./local-store";

export const CART_MAX_LINES=20,CART_MAX_QTY=10;
/**
 * Only the choice is stored: which variant and how many. Names, images and
 * prices are always re-read from the server; seenPrice exists solely to tell
 * the customer when a price changed since they added the item.
 */
export type CartLine={variantId:string;productId:string;quantity:number;seenPrice:string};
const uuid=/^[0-9a-f-]{36}$/i;
const isLine=(v:unknown):v is CartLine=>!!v&&typeof v==="object"&&uuid.test((v as CartLine).variantId)&&uuid.test((v as CartLine).productId)
  &&Number.isInteger((v as CartLine).quantity)&&(v as CartLine).quantity>=1&&(v as CartLine).quantity<=CART_MAX_QTY&&/^\d{1,15}$/.test((v as CartLine).seenPrice);
export const cartStore=createLocalStore<CartLine[]>("sf-cart-v1",[],(v):v is CartLine[]=>Array.isArray(v)&&v.length<=CART_MAX_LINES&&v.every(isLine));

export function addToCart(line:Omit<CartLine,"quantity">,quantity=1){
  cartStore.set(list=>{
    const found=list.find(l=>l.variantId===line.variantId);
    if(found)return list.map(l=>l.variantId===line.variantId?{...l,quantity:Math.min(CART_MAX_QTY,l.quantity+quantity),seenPrice:line.seenPrice}:l);
    return [...list,{...line,quantity:Math.min(CART_MAX_QTY,quantity)}].slice(-CART_MAX_LINES);
  });
}
export const setQuantity=(variantId:string,quantity:number)=>cartStore.set(list=>list.map(l=>l.variantId===variantId?{...l,quantity:Math.max(1,Math.min(CART_MAX_QTY,quantity))}:l));
export const removeLine=(variantId:string)=>cartStore.set(list=>list.filter(l=>l.variantId!==variantId));
export const cartCount=(list:CartLine[])=>list.reduce((n,l)=>n+l.quantity,0);
