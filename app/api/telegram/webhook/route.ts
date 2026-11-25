import {createHash,timingSafeEqual} from "node:crypto";
import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../lib/server/db";
import {privateHeaders} from "../../../../lib/server/http";
import {signInPhoneLookup,telegramPhone} from "../../../../lib/server/sign-in-phone";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/**
 * Telegram bot webhook. Its one job: bind a Telegram user to an investor account created by phone.
 *
 * The phone is never typed by the person. The Mini App calls Telegram.WebApp.requestContact(); if the
 * user agrees, Telegram sends that user's contact to the bot as a message, and Telegram calls this
 * route with the header X-Telegram-Bot-Api-Secret-Token set to the secret given to setWebhook
 * (core.telegram.org/bots/api#setwebhook, core.telegram.org/bots/webapps#initializing-mini-apps).
 * A contact counts only when its user_id is the sender's own id: anyone can forward somebody
 * else's contact card to a bot.
 *
 * Every authentic request is answered with the same 200, whatever happened, so the bot gets no
 * retries and nobody learns from the answer whether a phone is known.
 */
const ok=()=>NextResponse.json({ok:true},{headers:privateHeaders});
const digest=(value:string)=>createHash("sha256").update(value).digest();
type Update={update_id?:unknown;message?:{date?:unknown;chat?:{type?:unknown};from?:{id?:unknown;is_bot?:unknown};contact?:{phone_number?:unknown;user_id?:unknown}}};

export async function POST(request:Request){
 const secret=process.env.TELEGRAM_WEBHOOK_SECRET;
 if(!secret||!/^[A-Za-z0-9_-]{32,256}$/.test(secret))return NextResponse.json({error:"Unavailable"},{status:503,headers:privateHeaders});
 const given=request.headers.get("x-telegram-bot-api-secret-token")??"";
 if(!timingSafeEqual(digest(given),digest(secret)))return NextResponse.json({error:"Access denied"},{status:403,headers:privateHeaders});
 let update:Update;
 try{
  const text=await request.text();
  if(text.length>65536)return ok();
  update=JSON.parse(text);
 }catch{return ok();}
 const message=update?.message;const contact=message?.contact;const from=message?.from;
 const updateId=update?.update_id;
 if(typeof updateId!=="number"||!Number.isSafeInteger(updateId)||!message||!contact||!from)return ok();
 const sender=from.id;
 // Private chat, a person (not a bot), a recent message, and the sender's own contact.
 if(message.chat?.type!=="private"||from.is_bot===true||typeof sender!=="number"||!Number.isSafeInteger(sender)||sender<=0||contact.user_id!==sender)return ok();
 const sentAt=typeof message.date==="number"?message.date:0;
 if(Math.abs(Date.now()/1000-sentAt)>600)return ok();
 const phone=telegramPhone(contact.phone_number);
 if(!phone)return ok();
 try{
  const store=configuredStoreId();
  const lookup=signInPhoneLookup(store,phone);
  const c=await database().connect();
  try{
   await c.query("BEGIN");
   await c.query("DELETE FROM telegram_webhook_updates WHERE received_at<now()-interval '2 days'");
   const fresh=await c.query("INSERT INTO telegram_webhook_updates(update_id) VALUES($1) ON CONFLICT DO NOTHING RETURNING update_id",[updateId]);
   if(!fresh.rowCount){await c.query("ROLLBACK");return ok();}
   // Lock the pending phone row, then bind only if the account is an unbound investor and this
   // Telegram user is not linked to any account yet. accounts.telegram_user_id is UNIQUE as well.
   const pending=await c.query(`SELECT p.account_id FROM account_sign_in_phones p
    JOIN memberships m ON m.store_id=p.store_id AND m.account_id=p.account_id AND m.role='investor'
    JOIN accounts a ON a.id=p.account_id
    WHERE p.store_id=$1 AND p.phone_lookup=$2 AND p.bound_at IS NULL AND a.telegram_user_id IS NULL
    FOR UPDATE OF p,a`,[store,lookup]);
   if(pending.rowCount){
    const accountId=pending.rows[0].account_id;
    const bound=await c.query(`UPDATE accounts SET telegram_user_id=$2 WHERE id=$1 AND telegram_user_id IS NULL
     AND NOT EXISTS(SELECT 1 FROM accounts x WHERE x.telegram_user_id=$2) RETURNING id`,[accountId,String(sender)]);
    if(bound.rowCount){
     await c.query("UPDATE account_sign_in_phones SET bound_at=now() WHERE store_id=$1 AND account_id=$2",[store,accountId]);
     await c.query("INSERT INTO audit_events(store_id,actor_id,action,entity_type,entity_id) VALUES($1,NULL,'investor_sign_in_bound','account',$2)",[store,accountId]);
    }
   }
   await c.query("COMMIT");
  }catch{await c.query("ROLLBACK");}finally{c.release();}
 }catch{}
 return ok();
}
