"use client";

import { useCallback, useEffect, useState } from "react";
import { staffFetch } from "@/lib/staff-client";

type Customer = { id: string; name: string; phone_masked: string; has_passport: boolean };
type Payments = { terms: { agreed_total_uzs: string; payment_type: "cash" | "installment"; initial_due_uzs: string; cost_uzs: string | null; term_months: number | null } | null; receipts: { reversed: boolean }[]; received_uzs: string; remaining_uzs: string | null; manual_received_uzs: string; has_schedule: boolean };
type Funding = { principal: string | null; allocations: { amount_uzs: string }[]; enabled: boolean };
type Installments = { contract: { status: string } | null; schedule: { state: string }[]; has_passport: boolean };
type Returns = { cost: string | null; canPost: boolean; receipts: { posted: boolean }[]; correction: { allowed: boolean } | null };
export type WebsiteRequest = {
  checkout: { reference: string; channel: "cart" | "one_click"; name: string; phone: string; comment: string | null; created_at: string; telegram_signed_in: boolean } | null;
  siblings?: { id: string; request_status: string; sale_status: string; quantity: number | null; name: string | null; color: string | null; storage_label: string | null }[];
  existing_customer?: Customer | null;
  customer_linked?: boolean;
};
export type OrderProgress = {
  ready: boolean;
  /** null when the customer module is off or failed; the step then explains instead of blocking. */
  customer: { linked: Customer | null } | null;
  payments: Payments | null;
  funding: Funding | null;
  installments: Installments | null;
  returns: Returns | null;
  website: WebsiteRequest | null;
};

const optional = <T,>(url: string) => staffFetch<T>(url).catch(() => null);

/**
 * Read-only snapshot of where an order stands, taken from the same GET endpoints the sections use.
 * It decides which step is current; every action still goes through its own section and API call.
 */
export function useOrderProgress(endpoint: string, version: number, isWebsite: boolean, enabled = true) {
  const [progress, setProgress] = useState<OrderProgress>({ ready: false, customer: null, payments: null, funding: null, installments: null, returns: null, website: null });
  const load = useCallback(async () => {
    if (!enabled) return;
    const [customer, payments, funding, installments, returns, website] = await Promise.all([
      optional<{ customer: Customer | null }>(endpoint + "/customer"),
      optional<Payments>(endpoint + "/payments"),
      optional<Funding>(endpoint + "/funding"),
      optional<Installments>(endpoint + "/installments"),
      optional<Returns>(endpoint + "/capital-returns"),
      isWebsite ? optional<WebsiteRequest>(endpoint + "/website") : Promise.resolve(null),
    ]);
    setProgress({ ready: true, customer: customer ? { linked: customer.customer } : null, payments, funding, installments, returns, website });
  }, [endpoint, isWebsite, enabled]);
  useEffect(() => {
    void load();
  }, [load, version]);
  return { progress, reload: load };
}
