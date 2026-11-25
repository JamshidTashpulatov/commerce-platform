import type {MetadataRoute} from "next";
import {siteOrigin} from "@/lib/server/site";

export const dynamic="force-dynamic";

// Storefront pages are indexable; private areas, checkout and APIs are not crawled.
export default function robots():MetadataRoute.Robots{
  const origin=siteOrigin();
  return {
    rules:[{userAgent:"*",allow:"/",disallow:["/api/","/checkout","/staff","/admin","/login","/investor","/dashboard"]}],
    sitemap:origin+"/sitemap.xml",host:origin,
  };
}
