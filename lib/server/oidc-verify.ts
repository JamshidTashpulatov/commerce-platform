// Verification of Telegram Login (OpenID Connect) ID tokens, following
// https://core.telegram.org/widgets/login: check the signature against the
// published JWKS, then iss, aud (the bot ID) and exp. Pure and dependency-free
// so it can be unit tested without the network or a database.
import {createHash,createPublicKey,timingSafeEqual,verify,type JsonWebKey} from "node:crypto";

export const TELEGRAM_ISSUER="https://oauth.telegram.org";
export type Jwk=JsonWebKey&{kid?:string;alg?:string;use?:string};
export type TelegramClaims={telegramUserId:string;name:string|null;phone:string|null;expiresAt:Date;tokenHash:string};

const b64=(s:string)=>Buffer.from(s.replace(/-/g,"+").replace(/_/g,"/"),"base64");
function parse(part:string):Record<string,unknown>|null{
  try{const v=JSON.parse(b64(part).toString("utf8"));return v&&typeof v==="object"&&!Array.isArray(v)?v:null;}catch{return null;}
}

export function verifyIdToken(token:string,keys:Jwk[],clientId:string,{now=Math.floor(Date.now()/1000),nonce}:{now?:number;nonce?:string}={}):TelegramClaims|null{
  if(typeof token!=="string"||token.length>8192)return null;
  const parts=token.split(".");
  if(parts.length!==3||parts.some(p=>!/^[A-Za-z0-9_-]+$/.test(p)))return null;
  const header=parse(parts[0]),claims=parse(parts[1]);
  if(!header||!claims)return null;
  const alg=header.alg;
  const jwk=keys.find(k=>k.kid===header.kid&&(!k.alg||k.alg===alg))??(keys.length===1&&!header.kid?keys[0]:undefined);
  if(!jwk||typeof alg!=="string")return null;
  const data=Buffer.from(parts[0]+"."+parts[1]);
  const signature=b64(parts[2]);
  let ok=false;
  try{
    const key=createPublicKey({key:jwk,format:"jwk"});
    if(alg==="RS256"&&jwk.kty==="RSA")ok=verify("RSA-SHA256",data,key,signature);
    else if(alg==="ES256"&&jwk.kty==="EC"&&jwk.crv==="P-256")ok=verify("sha256",data,{key,dsaEncoding:"ieee-p1363"},signature);
    else if(alg==="ES256K"&&jwk.kty==="EC"&&jwk.crv==="secp256k1")ok=verify("sha256",data,{key,dsaEncoding:"ieee-p1363"},signature);
    else if(alg==="EdDSA"&&jwk.kty==="OKP"&&jwk.crv==="Ed25519")ok=verify(null,data,key,signature);
  }catch{ok=false;}
  if(!ok)return null;

  if(claims.iss!==TELEGRAM_ISSUER)return null;
  const aud=claims.aud;
  if(!(aud===clientId||(Array.isArray(aud)&&aud.includes(clientId))||(typeof aud==="number"&&String(aud)===clientId)))return null;
  const exp=claims.exp,iat=claims.iat;
  if(typeof exp!=="number"||exp<=now-30)return null;
  if(typeof iat==="number"&&iat>now+60)return null;
  if(nonce!==undefined&&claims.nonce!==undefined){
    const a=Buffer.from(String(claims.nonce)),b=Buffer.from(nonce);
    if(a.length!==b.length||!timingSafeEqual(a,b))return null;
  }
  const rawId=claims.id??claims.sub;
  const telegramUserId=typeof rawId==="number"&&Number.isSafeInteger(rawId)&&rawId>0?String(rawId):typeof rawId==="string"&&/^[1-9]\d{0,19}$/.test(rawId)?rawId:null;
  if(!telegramUserId)return null;
  const name=typeof claims.name==="string"&&claims.name.trim()?claims.name.trim().slice(0,80)
    :[claims.given_name,claims.family_name].filter(v=>typeof v==="string"&&v.trim()).join(" ").slice(0,80)||null;
  const rawPhone=typeof claims.phone_number==="string"?claims.phone_number.replace(/[\s()-]/g,""):"";
  const phone=rawPhone?(rawPhone.startsWith("+")?rawPhone:"+"+rawPhone):null;
  return {telegramUserId,name,phone:phone&&/^\+[1-9]\d{7,14}$/.test(phone)?phone:null,
    expiresAt:new Date(exp*1000),tokenHash:createHash("sha256").update(token).digest("hex")};
}

/** PKCE S256 challenge for a code verifier. */
export const pkceChallenge=(verifier:string)=>createHash("sha256").update(verifier).digest("base64url");
