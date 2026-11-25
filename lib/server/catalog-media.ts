import "server-only";
import {isAppleCatalogImage} from "../apple-catalog-image";
export const localMediaId=(value:string)=>/^\/api\/catalog\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.exec(value)?.[1]??null;
export function approvedImageUrl(value:string):boolean{
 if(localMediaId(value))return true;
 if(!value||value.length>2048)return false;
 try{
 const u=new URL(value);
 if(isAppleCatalogImage(u))return true;
 const hosts=(process.env.CATALOG_IMAGE_HOSTS??"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
 return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&hosts.includes(u.hostname.toLowerCase());
 }catch{return false;}
}
