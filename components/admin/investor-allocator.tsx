"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDownIcon, ScaleIcon, XIcon } from "lucide-react";
import { InlineError, Money, MoneyInput, Notice, SummaryList, TextField, formatSum, isAdminRole, useStaffRole } from "./kit";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { equalSplit } from "@/lib/funding-split";

export type AllocatorInvestor = { account_id: string; name: string; available_for_order_uzs: string };
const zero = BigInt(0);
const amountOf = (value: string | undefined) => BigInt(value || "0");

/**
 * Choose which investors fund an order and how much each puts in.
 * `entries` holds one amount per selected investor (an empty string means selected, no amount yet).
 * The server checks everything again when the allocation is saved; this only helps to get it right.
 */
export function InvestorAllocator({ investors, principal, entries, onChange, disabled }: { investors: AllocatorInvestor[]; principal: bigint; entries: Record<string, string>; onChange: (entries: Record<string, string>) => void; disabled: boolean }) {
  const role = useStaffRole();
  const [splitError, setSplitError] = useState("");
  const selected = investors.filter(i => i.account_id in entries);
  const sum = selected.reduce((n, i) => n + amountOf(entries[i.account_id]), zero);
  const remaining = principal - sum;
  const noCapital = investors.length > 0 && investors.every(i => amountOf(i.available_for_order_uzs) <= zero);

  function toggle(id: string, on: boolean) {
    setSplitError("");
    const next = { ...entries };
    if (on) next[id] = next[id] ?? "";
    else delete next[id];
    onChange(next);
  }
  function splitEqually() {
    const result = equalSplit(principal, selected.map(i => ({ id: i.account_id, available: amountOf(i.available_for_order_uzs) })));
    if (result.short.length) {
      // Nothing is moved to the others: say who is short and by how much.
      setSplitError(
        `Teng ulush ${formatSum(result.short[0].share)} bo‘ladi. ` +
          result.short.map(s => `${investors.find(i => i.account_id === s.id)?.name ?? "Investor"}da ${formatSum(s.missing)} yetmaydi`).join(", ") +
          ". Boshqa investor qo‘shing yoki summalarni qo‘lda kiriting."
      );
      return;
    }
    setSplitError("");
    onChange(Object.fromEntries(selected.map(i => [i.account_id, result.shares[i.account_id] ?? ""])));
  }

  if (!investors.length)
    return (
      <Notice>
        Investor hisoblari mavjud emas. Administrator ularni{" "}
        {isAdminRole(role) ? (
          <Link href="/staff/investors" className="underline underline-offset-4">
            «Investorlar» sahifasida
          </Link>
        ) : (
          "«Investorlar» sahifasida"
        )}{" "}
        yaratadi.
      </Notice>
    );

  return (
    <div className="flex flex-col gap-4">
      {noCapital && (
        <Notice>
          Hech bir investorda bo‘sh kapital yo‘q. Avval administrator{" "}
          {isAdminRole(role) ? (
            <Link href="/staff/investors" className="underline underline-offset-4">
              «Investorlar» sahifasida
            </Link>
          ) : (
            "«Investorlar» sahifasida"
          )}{" "}
          kapital kiritilishini qayd etishi kerak.
        </Notice>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button type="button" variant="outline" className="w-full justify-between sm:w-80" disabled={disabled} />}>
            <span className="truncate">{selected.length ? `${selected.length} ta investor tanlandi` : "Investorlarni tanlang"}</span>
            <ChevronDownIcon data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 w-(--anchor-width) min-w-72 overflow-y-auto overscroll-contain">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Investor va bo‘sh kapitali</DropdownMenuLabel>
              {investors.map(i => {
                const available = amountOf(i.available_for_order_uzs);
                const empty = available <= zero && !(i.account_id in entries);
                return (
                  <DropdownMenuCheckboxItem key={i.account_id} checked={i.account_id in entries} disabled={empty} closeOnClick={false} onCheckedChange={on => toggle(i.account_id, on)}>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{i.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{empty ? "Bo‘sh kapital yo‘q" : formatSum(available)}</span>
                    </span>
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button type="button" variant="secondary" disabled={disabled || !selected.length} onClick={splitEqually}>
          <ScaleIcon data-icon="inline-start" />
          Teng taqsimlash
        </Button>
      </div>
      <InlineError message={splitError} />
      {selected.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {selected.map(i => {
            const available = amountOf(i.available_for_order_uzs);
            const over = amountOf(entries[i.account_id]) > available;
            return (
              <li key={i.account_id} className="flex items-start gap-2">
                <TextField
                  label={i.name}
                  className="max-w-sm flex-1"
                  description={
                    <>
                      Bo‘sh kapital: <Money value={available} />
                    </>
                  }
                  error={over ? `Bo‘sh kapitaldan ${formatSum(amountOf(entries[i.account_id]) - available)} ko‘p.` : undefined}
                >
                  {id => (
                    <MoneyInput
                      id={id}
                      name={"allocation-" + i.account_id}
                      disabled={disabled}
                      value={entries[i.account_id] ?? ""}
                      aria-invalid={over || undefined}
                      onChange={value => {
                        setSplitError("");
                        onChange({ ...entries, [i.account_id]: value });
                      }}
                    />
                  )}
                </TextField>
                <Button type="button" variant="ghost" size="icon" className="mt-6" aria-label={i.name + "ni ro‘yxatdan olib tashlash"} disabled={disabled} onClick={() => toggle(i.account_id, false)}>
                  <XIcon />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Investorlarni tanlang, so‘ng summani teng taqsimlang yoki har biriga qo‘lda kiriting.</p>
      )}
      <SummaryList
        rows={[
          ["Moliyalashtiriladigan tan narxi", <Money key="p" value={principal} />],
          ["Jami taqsimlangan", <Money key="s" value={sum} />],
          [remaining < zero ? "Ortiqcha taqsimlangan" : "Taqsimlanmagan qoldiq", <Money key="r" value={remaining < zero ? -remaining : remaining} className={remaining < zero ? "text-destructive" : undefined} />],
        ]}
      />
    </div>
  );
}
