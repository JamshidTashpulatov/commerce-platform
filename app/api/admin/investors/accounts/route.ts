import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../../lib/server/db";
import {requireStoreRole} from "../../../../../lib/server/auth";
import {isUuid,sameOrigin,smallJson,privateHeaders} from "../../../../../lib/server/http";
import {adminPhone,sealSignInPhone,signInPhoneKeys} from "../../../../../lib/server/sign-in-phone";
export const runtime="nodejs";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Ruxsat yo‘q"},403);
 const b=await smallJson(request);
 if(b?.action==="resetSignIn")return resetSignIn(b.accountId);
 if(b?.action==="setSignInPhone")return setSignInPhone(b.accountId,b.phone);
 const name=typeof b?.name==="string"?b.name.trim():"";
 // New accounts are created by phone. The Telegram ID form stays for accounts provisioned the old way.
 const byPhone=b?.phone!==undefined;
 const phone=byPhone?adminPhone(b?.phone):null;
 const telegramId=typeof b?.telegramId==="string"?b.telegramId.trim():"";
 if(name.length<2||name.length>120)return reply({error:"Investor ismini kiriting (kamida 2 belgi)."},400);
 if(byPhone&&!phone)return reply({error:"Telefon raqamni +998 XX XXX XX XX ko‘rinishida kiriting."},400);
 if(!byPhone&&(!/^[1-9][0-9]{0,15}$/.test(telegramId)||BigInt(telegramId)>BigInt("4503599627370495")))return reply({error:"Investor nomi va Telegram ID raqamini tekshiring"},400);
 try{
 const store=configuredStoreId();
 const member=await requireStoreRole(store,["owner","admin"]);if(!member)return reply({error:"Ruxsat yo‘q"},403);
 if(byPhone){try{signInPhoneKeys();}catch{return reply({error:"Telefon orqali hisob yaratish serverda sozlanmagan."},503);}}
 const c=await database().connect();
 try{
 await c.query("BEGIN");
 const a=byPhone?await c.query("INSERT INTO accounts DEFAULT VALUES RETURNING id")
  :await c.query("INSERT INTO accounts(telegram_user_id) VALUES($1) ON CONFLICT(telegram_user_id) DO NOTHING RETURNING id",[telegramId]);
 if(!a.rowCount){await c.query("ROLLBACK");return reply({error:"Bu Telegram hisobiga bog‘langan akkaunt mavjud. Administrator tekshirishi kerak."},409);}
 const id=a.rows[0].id;
 await c.query("INSERT INTO memberships(store_id,account_id,role) VALUES($1,$2,'investor')",[store,id]);
 await c.query("INSERT INTO investor_profiles(store_id,account_id,display_name) VALUES($1,$2,$3)",[store,id,name]);
 if(byPhone&&phone){
  const sealed=sealSignInPhone(store,id,phone);
  const saved=await c.query("INSERT INTO account_sign_in_phones(store_id,account_id,phone_cipher,phone_lookup,created_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(store_id,phone_lookup) DO NOTHING RETURNING account_id",[store,id,sealed.cipher,sealed.lookup,member.account_id]);
  if(!saved.rowCount){await c.query("ROLLBACK");return reply({error:"Bu telefon raqam bilan investor hisobi allaqachon mavjud."},409);}
 }
 await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'investor_created','account',$3)",[store,member.account_id,id]);
 await c.query("COMMIT");return reply({id,name},201);
 }catch{await c.query("ROLLBACK");return reply({error:"Investor hisobini yaratib bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
/**
 * Explicit administrator action: forget the bound Telegram user of a phone-created investor,
 * end that investor's sessions, and let the phone be confirmed again from the Mini App.
 */
async function resetSignIn(accountId:unknown){
 if(!isUuid(accountId))return reply({error:"Investor topilmadi"},400);
 try{
 const store=configuredStoreId();
 const member=await requireStoreRole(store,["owner","admin"]);if(!member)return reply({error:"Ruxsat yo‘q"},403);
 const c=await database().connect();
 try{
 await c.query("BEGIN");
 const row=await c.query(`SELECT p.account_id FROM account_sign_in_phones p
  JOIN memberships m ON m.store_id=p.store_id AND m.account_id=p.account_id AND m.role='investor'
  WHERE p.store_id=$1 AND p.account_id=$2 FOR UPDATE OF p`,[store,accountId]);
 if(!row.rowCount){await c.query("ROLLBACK");return reply({error:"Bu investor telefon raqam orqali yaratilmagan."},409);}
 await c.query("UPDATE accounts SET telegram_user_id=NULL WHERE id=$1",[accountId]);
 await c.query("UPDATE account_sign_in_phones SET bound_at=NULL WHERE store_id=$1 AND account_id=$2",[store,accountId]);
 await c.query("UPDATE sessions SET revoked_at=now() WHERE account_id=$1 AND revoked_at IS NULL",[accountId]);
 await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'investor_sign_in_reset','account',$3)",[store,member.account_id,accountId]);
 await c.query("COMMIT");return reply({reset:true});
 }catch{await c.query("ROLLBACK");return reply({error:"Kirishni qayta sozlab bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
/**
 * Give a sign-in phone to an investor account that has neither a Telegram user nor a phone yet
 * (accounts provisioned without one). An account that is already linked or already has a phone
 * is left alone: changing those goes through "resetSignIn" first.
 */
async function setSignInPhone(accountId:unknown,rawPhone:unknown){
 if(!isUuid(accountId))return reply({error:"Investor topilmadi"},400);
 const phone=adminPhone(rawPhone);
 if(!phone)return reply({error:"Telefon raqamni +998 XX XXX XX XX ko‘rinishida kiriting."},400);
 try{
 const store=configuredStoreId();
 const member=await requireStoreRole(store,["owner","admin"]);if(!member)return reply({error:"Ruxsat yo‘q"},403);
 try{signInPhoneKeys();}catch{return reply({error:"Telefon orqali hisob yaratish serverda sozlanmagan."},503);}
 const c=await database().connect();
 try{
 await c.query("BEGIN");
 const row=await c.query(`SELECT a.telegram_user_id,p.account_id AS has_phone FROM memberships m JOIN accounts a ON a.id=m.account_id
  LEFT JOIN account_sign_in_phones p ON p.store_id=m.store_id AND p.account_id=m.account_id
  WHERE m.store_id=$1 AND m.account_id=$2 AND m.role='investor' FOR UPDATE OF a`,[store,accountId]);
 if(!row.rowCount){await c.query("ROLLBACK");return reply({error:"Investor topilmadi"},404);}
 if(row.rows[0].telegram_user_id||row.rows[0].has_phone){await c.query("ROLLBACK");return reply({error:"Bu investorda kirish allaqachon sozlangan. Avval kirishni qayta sozlang."},409);}
 const sealed=sealSignInPhone(store,accountId,phone);
 const saved=await c.query("INSERT INTO account_sign_in_phones(store_id,account_id,phone_cipher,phone_lookup,created_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(store_id,phone_lookup) DO NOTHING RETURNING account_id",[store,accountId,sealed.cipher,sealed.lookup,member.account_id]);
 if(!saved.rowCount){await c.query("ROLLBACK");return reply({error:"Bu telefon raqam bilan investor hisobi allaqachon mavjud."},409);}
 await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'investor_sign_in_phone_set','account',$3)",[store,member.account_id,accountId]);
 await c.query("COMMIT");return reply({saved:true},201);
 }catch{await c.query("ROLLBACK");return reply({error:"Telefon raqamni saqlab bo‘lmadi"},503);}finally{c.release();}
 }catch{return reply({error:"Xizmat vaqtincha ishlamayapti"},503);}
}
