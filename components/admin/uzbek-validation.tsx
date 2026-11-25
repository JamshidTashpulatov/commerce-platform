"use client";

import { useEffect } from "react";

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
const isField = (target: EventTarget | null): target is Field => target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;

function message(el: Field) {
  const v = el.validity;
  if (v.valueMissing) return el instanceof HTMLSelectElement ? "Ro‘yxatdan birini tanlang." : el.type === "file" ? "Fayl tanlang." : "Bu maydonni to‘ldiring.";
  if (v.typeMismatch) return el.type === "email" ? "Email manzilini to‘g‘ri kiriting." : "Qiymatni to‘g‘ri kiriting.";
  if (v.tooShort && "minLength" in el) return `Kamida ${el.minLength} ta belgi kiriting.`;
  if (v.tooLong && "maxLength" in el) return `Ko‘pi bilan ${el.maxLength} ta belgi kiriting.`;
  if (v.rangeUnderflow && "min" in el) return `Qiymat ${el.min} dan kichik bo‘lmasin.`;
  if (v.rangeOverflow && "max" in el) return `Qiymat ${el.max} dan katta bo‘lmasin.`;
  if (v.stepMismatch || v.badInput) return "To‘g‘ri son kiriting.";
  if (v.patternMismatch) return "Qiymat kerakli ko‘rinishda emas.";
  return "";
}

/**
 * Replaces the browser's built-in validation bubbles ("Please fill out this field.") with Uzbek text
 * for every form on the page. Mounted once per private page frame.
 */
export function UzbekValidation() {
  useEffect(() => {
    const onInvalid = (event: Event) => {
      const el = event.target;
      if (!isField(el)) return;
      el.setCustomValidity("");
      el.setCustomValidity(message(el));
    };
    const clear = (event: Event) => {
      if (isField(event.target)) event.target.setCustomValidity("");
    };
    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", clear, true);
    document.addEventListener("change", clear, true);
    return () => {
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("input", clear, true);
      document.removeEventListener("change", clear, true);
    };
  }, []);
  return null;
}
