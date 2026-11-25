import type {MetadataRoute} from "next";
import {STORE_DESCRIPTION,STORE_NAME} from "@/lib/storefront";

export default function manifest():MetadataRoute.Manifest{
  return {
    name:STORE_NAME,short_name:STORE_NAME,description:STORE_DESCRIPTION,lang:"uz",
    start_url:"/",scope:"/",display:"standalone",background_color:"#ffffff",theme_color:"#ffffff",
    icons:[
      {src:"/icons/icon-192.png",sizes:"192x192",type:"image/png"},
      {src:"/icons/icon-512.png",sizes:"512x512",type:"image/png"},
      {src:"/icons/maskable-512.png",sizes:"512x512",type:"image/png",purpose:"maskable"},
    ],
  };
}
