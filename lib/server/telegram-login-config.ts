import "server-only";
import {configuredStoreId} from "./db";
import {currentCustomer,maskPhone} from "./customer-session";

/** What the storefront needs to show the Telegram option and a signed-in customer. */
export async function telegramLoginState(next:string){
  const configured=!!process.env.TELEGRAM_LOGIN_CLIENT_ID&&!!process.env.TELEGRAM_LOGIN_CLIENT_SECRET&&!!process.env.APP_ORIGIN;
  let customer=null;
  try{
    const c=await currentCustomer(configuredStoreId());
    if(c)customer={name:c.name,phoneMasked:c.phone?maskPhone(c.phone):null};
  }catch{customer=null;}
  return {configured,customer,startHref:"/api/customer/telegram/start?next="+encodeURIComponent(next)};
}
