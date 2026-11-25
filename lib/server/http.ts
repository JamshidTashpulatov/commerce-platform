import "server-only";
export const privateHeaders={"Cache-Control":"private, no-store"};
export const isUuid=(v:unknown):v is string=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function sameOrigin(request:Request){
 const origin=process.env.APP_ORIGIN;
 return !!origin&&request.headers.get("origin")===origin&&request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()==="application/json";
}
export async function smallJson(request:Request):Promise<Record<string,unknown>|null>{
 const reader=request.body?.getReader();if(!reader)return null;
 const chunks:Uint8Array[]=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>8192){await reader.cancel();return null;}chunks.push(value);}
 const value:unknown=JSON.parse(Buffer.concat(chunks).toString("utf8"));
 return value!==null&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null;}catch{return null;}
}
