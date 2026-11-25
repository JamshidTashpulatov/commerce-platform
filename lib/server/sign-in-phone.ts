import "server-only";
import { customerKeys, fieldContext, lookupPhone, normalizedPhone, seal, unseal } from "./customer-crypto";

/** Keys for investor sign-in phones: the same root key and helpers as customer phones. */
export function signInPhoneKeys() {
  return customerKeys(process.env.CUSTOMER_DATA_KEY);
}
const context = (store: string, accountId: string) => fieldContext(store, accountId, "sign_in_phone");

/** An Uzbek mobile number typed by the administrator, as +998XXXXXXXXX, or null. */
export function adminPhone(value: unknown) {
  const phone = normalizedPhone(value);
  return phone && /^\+998\d{9}$/.test(phone) ? phone : null;
}
/** Telegram sends contact numbers with or without the leading plus. */
export function telegramPhone(value: unknown) {
  if (typeof value !== "string" || value.length > 32) return null;
  const digits = value.replace(/[^0-9]/g, "");
  return normalizedPhone("+" + digits);
}
export function sealSignInPhone(store: string, accountId: string, phone: string) {
  const keys = signInPhoneKeys();
  return { cipher: seal(keys.encryption, phone, context(store, accountId)), lookup: lookupPhone(keys.lookup, store, phone) };
}
export function signInPhoneLookup(store: string, phone: string) {
  return lookupPhone(signInPhoneKeys().lookup, store, phone);
}
/** +998 ••• •• 67, the same shape customer phones are shown in. */
export function maskedSignInPhone(store: string, accountId: string, cipher: string) {
  try {
    const phone = unseal(signInPhoneKeys().encryption, cipher, context(store, accountId));
    return phone.slice(0, 4) + " ••• •• " + phone.slice(-2);
  } catch {
    return null;
  }
}
