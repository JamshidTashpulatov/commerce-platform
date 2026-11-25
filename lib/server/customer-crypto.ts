import {createCipheriv,createDecipheriv,createHmac,randomBytes} from "node:crypto";
export function customerKeys(encoded:string|undefined){
 if(!encoded||!/^[0-9a-fA-F]{64}$/.test(encoded))throw new Error("CUSTOMER_KEY_NOT_CONFIGURED");
 const root=Buffer.from(encoded,"hex");
 return {encryption:createHmac("sha256",root).update("commerce/customer/encryption/v1").digest(),lookup:createHmac("sha256",root).update("commerce/customer/lookup/v1").digest()};
}
export function normalizedPhone(value:unknown){
 if(typeof value!=="string"||value.length>32)return null;
 const phone=value.trim().replace(/[ ()-]/g,"");
 return /^\+[1-9]\d{7,14}$/.test(phone)?phone:null;
}
export function lookupPhone(key:Buffer,store:string,phone:string){return createHmac("sha256",key).update(JSON.stringify([store,phone])).digest("hex");}
export function seal(key:Buffer,value:string,context:string){
 const iv=randomBytes(12);const cipher=createCipheriv("aes-256-gcm",key,iv);
 cipher.setAAD(Buffer.from(context));
 const encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
 return ["v1",iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),encrypted.toString("base64url")].join(".");
}
export function unseal(key:Buffer,value:string,context:string){
 const [version,nonce,tag,body]=value.split(".");
 if(version!=="v1"||!nonce||!tag||!body)throw new Error("INVALID_ENVELOPE");
 const decipher=createDecipheriv("aes-256-gcm",key,Buffer.from(nonce,"base64url"));decipher.setAAD(Buffer.from(context));decipher.setAuthTag(Buffer.from(tag,"base64url"));
 return Buffer.concat([decipher.update(Buffer.from(body,"base64url")),decipher.final()]).toString("utf8");
}
export const fieldContext=(store:string,id:string,field:string)=>JSON.stringify([store,id,field]);
