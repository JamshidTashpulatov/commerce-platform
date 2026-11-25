import type {Metadata} from "next";
import {CheckoutView} from "../../../components/store/checkout-view";
import {wrap} from "../../../components/store/bits";
import {checkoutEnabled} from "../../../lib/server/checkout";
import {telegramLoginState} from "../../../lib/server/telegram-login-config";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Rasmiylashtirish",robots:{index:false}};

export default async function CheckoutPage(){
  return <div className={wrap+" pb-24"}>
    <CheckoutView enabled={checkoutEnabled()} telegram={await telegramLoginState("/checkout")}/>
  </div>;
}
