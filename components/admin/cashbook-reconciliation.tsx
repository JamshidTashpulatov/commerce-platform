"use client";

import { useState } from "react";
import { Money, Section, TableFrame } from "./kit";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Props = { opening: string; groups: { kind: string; amount_uzs: string }[] };

/** Compare the period with a source document. Entries stay on this screen only, nothing is saved. */
export function CashbookReconciliation({ opening, groups }: Props) {
  const [expected, setExpected] = useState<Record<string, string>>({});
  const amounts = new Map(groups.map(g => [g.kind, g.amount_uzs]));
  const checks: [string, string, string][] = [
    ["opening", "Davr boshidagi qoldiq", opening],
    ["cash", "To‘liq to‘lovlar", amounts.get("cash_sale_receipt") ?? "0"],
    ["initial", "Boshlang‘ich to‘lovlar", amounts.get("initial_receipt") ?? "0"],
    ["monthly", "Oylik tushumlar", amounts.get("monthly_receipt") ?? "0"],
    ["reversals", "Bekor qilingan tushumlar", String(-BigInt(amounts.get("manual_receipt_reversal") ?? 0) - BigInt(amounts.get("monthly_receipt_reversal") ?? 0))],
  ];
  return (
    <Section title="Manba hujjat bilan solishtirish" description="Tanlangan davr uchun daftar yoki Excel'dagi summalarni kiriting. Farq: manba summasidan tizimdagi summa ayiriladi. Bu yerda kiritilgan raqamlar saqlanmaydi.">
      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ko‘rsatkich</TableHead>
              <TableHead className="text-right">Tizimda</TableHead>
              <TableHead>Manbada</TableHead>
              <TableHead className="text-right">Farq</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {checks.map(([key, label, amount]) => {
              const value = expected[key] ?? "";
              const ready = value !== "" && value !== "-";
              const diff = ready ? BigInt(value) - BigInt(amount) : null;
              return (
                <TableRow key={key}>
                  <TableCell className="font-medium">{label}</TableCell>
                  <TableCell className="text-right">
                    <Money value={amount} />
                  </TableCell>
                  <TableCell>
                    <Input
                      name={"expected-" + key}
                      inputMode="text"
                      aria-label={label + " — manbadagi summa"}
                      className="min-w-32 tabular-nums"
                      maxLength={32}
                      placeholder="0"
                      value={value}
                      onChange={e => {
                        const next = e.target.value;
                        if (/^-?\d*$/.test(next)) setExpected(v => ({ ...v, [key]: next }));
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right">{diff === null ? "—" : <Money value={diff} className={diff === BigInt(0) ? undefined : "font-medium text-destructive"} />}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableFrame>
    </Section>
  );
}
