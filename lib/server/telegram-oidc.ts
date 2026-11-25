import "server-only";
import {createHash,randomBytes} from "node:crypto";
import {database,configuredStoreId} from "./db";
import {createCustomerSession} from "./customer-session";
import {pkceChallenge,verifyIdToken,type Jwk} from "./oidc-verify";

// Endpoints from Telegram's OpenID configuration (https://core.telegram.org/widgets/login).
const AUTH="https://oauth.telegram.org/auth",TOKEN="https://oauth.telegram.org/token",JWKS="https://oauth.telegram.org/.well-known/jwks.json";
export const loginCookie="__Host-tg_login";

export function oidcConfig(){
  const clientId=process.env.TELEGRAM_LOGIN_CLIENT_ID,clientSecret=process.env.TELEGRAM_LOGIN_CLIENT_SECRET,origin=process.env.APP_ORIGIN;
  if(!clientId||!/^\d{1,20}$/.test(clientId)||!clientSecret||!origin)return null;
  return {clientId,clientSecret,redirectUri:origin+"/api/customer/telegram/callback"};
}
/** Only same-site relative paths, so the login cannot be used as an open redirect. */
export const safeNext=(v:string|null)=>v&&/^\/(?!\/)[\w\-./?=&%]*$/.test(v)&&v.length<200?v:"/checkout";

export function beginLogin(next:string){
  const config=oidcConfig();if(!config)return null;
  const state=randomBytes(24).toString("base64url"),verifier=randomBytes(48).toString("base64url"),nonce=randomBytes(16).toString("base64url");
  const url=new URL(AUTH);
  for(const [k,v] of Object.entries({client_id:config.clientId,redirect_uri:config.redirectUri,response_type:"code",scope:"openid profile phone",
    state,nonce,code_challenge:pkceChallenge(verifier),code_challenge_method:"S256"}))url.searchParams.set(k,v);
  return {url:url.toString(),cookie:Buffer.from(JSON.stringify({state,verifier,nonce,next})).toString("base64url")};
}

let jwks:{keys:Jwk[];at:number}|null=null;
async function signingKeys(force=false){
  if(!force&&jwks&&Date.now()-jwks.at<3600_000)return jwks.keys;
  const res=await fetch(JWKS,{signal:AbortSignal.timeout(8000),cache:"no-store"});
  const body=await res.json();
  if(!res.ok||!Array.isArray(body?.keys))throw new Error("JWKS_UNAVAILABLE");
  jwks={keys:body.keys,at:Date.now()};
  return jwks.keys;
}

/** Exchange the code, verify the ID token, and open a customer session. Returns the session token or null. */
export async function finishLogin(code:string,state:string,cookie:string|undefined){
  const config=oidcConfig();if(!config||!cookie)return null;
  let saved:{state:string;verifier:string;nonce:string;next:string};
  try{saved=JSON.parse(Buffer.from(cookie,"base64url").toString("utf8"));}catch{return null;}
  const a=createHash("sha256").update(state).digest(),b=createHash("sha256").update(String(saved.state)).digest();
  if(!a.equals(b)||!/^[\w-]{10,200}$/.test(code))return null;
  const res=await fetch(TOKEN,{method:"POST",signal:AbortSignal.timeout(8000),cache:"no-store",
    headers:{Authorization:"Basic "+Buffer.from(config.clientId+":"+config.clientSecret).toString("base64"),"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({grant_type:"authorization_code",code,redirect_uri:config.redirectUri,client_id:config.clientId,code_verifier:saved.verifier})});
  const body=await res.json().catch(()=>null);
  if(!res.ok||typeof body?.id_token!=="string")return null;
  let claims=verifyIdToken(body.id_token,await signingKeys(),config.clientId,{nonce:saved.nonce});
  if(!claims)claims=verifyIdToken(body.id_token,await signingKeys(true),config.clientId,{nonce:saved.nonce}); // keys may have rotated
  if(!claims)return null;
  const session=await openSession(claims.telegramUserId,claims.name,claims.phone,claims.tokenHash,claims.expiresAt);
  return session?{...session,next:saved.next}:null;
}

/** Create or reuse the Telegram account and open a customer-only session; replays are refused. */
export async function openSession(telegramUserId:string,name:string|null,phone:string|null,assertion:string,expiresAt:Date){
  const storeId=configuredStoreId();
  const client=await database().connect();
  try{
    await client.query("BEGIN");
    const replay=await client.query("INSERT INTO telegram_auth_assertions(assertion_hash,expires_at) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING assertion_hash",[assertion,expiresAt]);
    if(!replay.rowCount){await client.query("ROLLBACK");return null;}
    await client.query("INSERT INTO accounts(telegram_user_id) VALUES($1) ON CONFLICT(telegram_user_id) DO NOTHING",[telegramUserId]);
    const account=(await client.query("SELECT id FROM accounts WHERE telegram_user_id=$1",[telegramUserId])).rows[0].id as string;
    const session=await createCustomerSession(client,storeId,account,name,phone);
    await client.query("COMMIT");
    return session;
  }catch{await client.query("ROLLBACK").catch(()=>{});return null;}finally{client.release();}
}
