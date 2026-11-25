import "server-only";
export function approvedImageUrl(value:string):boolean{
 if(!value||value.length>2048)return false;
 try{
 const u=new URL(value);
 const hosts=(process.env.CATALOG_IMAGE_HOSTS??"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
 return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&hosts.includes(u.hostname.toLowerCase());
 }catch{return false;}
}
