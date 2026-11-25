import "server-only";
import {createHash,randomBytes} from "node:crypto";
import {cookies} from "next/headers";
import type {PoolClient} from "pg";
import {database} from "./db";
import {customerConfig} from "./customers";
import {fieldContext,seal,unseal} from "./customer-crypto";

// Customers have their own cookie and table. Staff authorization (requireStoreRole)
// reads only `sessions`, so nothing here can grant staff, seller, investor or admin access.
export const customerCookie="__Host-store_customer";
export const customerCookieOptions={httpOnly:true,secure:true,sameSite:"lax",path:"/"} as const;
const HOURS=24*30;

const hashToken=(token:string)=>createHash("sha256").update(token).digest("hex");

export async function createCustomerSession(client:PoolClient,storeId:string,accountId:string,name:string|null,phone:string|null){
  const keys=customerConfig();
  const token=randomBytes(32).toString("base64url");
  const tokenHash=hashToken(token);
  await client.query(
    `INSERT INTO customer_sessions(token_hash,store_id,account_id,name_cipher,phone_cipher,expires_at) VALUES($1,$2,$3,$4,$5,now()+make_interval(hours=>$6))`,
    [tokenHash,storeId,accountId,name?seal(keys.encryption,name,fieldContext(storeId,tokenHash,"session-name")):null,
     phone?seal(keys.encryption,phone,fieldContext(storeId,tokenHash,"session-phone")):null,HOURS]);
  return {token,maxAge:HOURS*3600};
}

export type CustomerSession={accountId:string;tokenHash:string;name:string|null;phone:string|null};
export async function currentCustomer(storeId:string):Promise<CustomerSession|null>{
  const token=(await cookies()).get(customerCookie)?.value;
  if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
  const tokenHash=hashToken(token);
  const {rows}=await database().query(
    "SELECT account_id,name_cipher,phone_cipher FROM customer_sessions WHERE token_hash=$1 AND store_id=$2 AND revoked_at IS NULL AND expires_at>now()",[tokenHash,storeId]);
  if(!rows.length)return null;
  const keys=customerConfig();
  const open=(v:string|null,f:string)=>{try{return v?unseal(keys.encryption,v,fieldContext(storeId,tokenHash,f)):null;}catch{return null;}};
  return {accountId:rows[0].account_id,tokenHash,name:open(rows[0].name_cipher,"session-name"),phone:open(rows[0].phone_cipher,"session-phone")};
}
export const maskPhone=(phone:string)=>phone.slice(0,4)+" ••• •• "+phone.slice(-2);
