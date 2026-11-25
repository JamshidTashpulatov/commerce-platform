"use client";
import {createLocalStore} from "./local-store";

/**
 * Contact details remembered on this device, only when the customer ticks
 * "eslab qolish". Never put into URLs; "Meni unut" clears it.
 */
export type SavedContact={name:string;phone:string};
export const contactStore=createLocalStore<SavedContact|null>("sf-contact-v1",null,(v):v is SavedContact|null=>v===null||
  (!!v&&typeof v==="object"&&typeof (v as SavedContact).name==="string"&&(v as SavedContact).name.length<=80&&/^\+998\d{9}$/.test((v as SavedContact).phone)));
export const maskPhone=(phone:string)=>phone.slice(0,4)+" ••• •• "+phone.slice(-2);
