import { Notice } from "./kit";

/**
 * Free capital is computed from the records in this system only: contributions minus funding
 * that is still outstanding. Contracts made before the system was in use are not entered, so the
 * money tied up in them is not subtracted and the real free cash can be much lower.
 * norman: fixed warning, remove once the historical contracts or an agreed opening position are entered.
 */
export function CapitalCaveat() {
  return <Notice>Bo‘sh kapital faqat shu tizimga kiritilgan qaydlar bo‘yicha hisoblangan. Tizimgacha tuzilgan shartnomalardagi mablag‘ ayirilmagan, shuning uchun haqiqiy bo‘sh pul bundan kam bo‘lishi mumkin. Biriktirishdan oldin haqiqiy qoldiqni tekshiring.</Notice>;
}
