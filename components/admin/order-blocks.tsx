"use client";

import { CheckIcon, EllipsisIcon, PlusIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { EmptyState, Money, Notice, StatusBadge, TableFrame, formatDay, formatStamp, formatSum, roleLabels, type StaffRole } from "./kit";
import type { OrderEvent, OrderInvestors, OrderProgress } from "./order-progress";
import { paymentMethods } from "./order-payments";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const zero = BigInt(0);

/** A plain block of the order page: a title, an optional action, content. Always visible. */
export function Block({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div className="flex min-h-9 items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** One thin line of small labels: what is done and what is next. No descriptions. */
export function ProgressLine({ steps }: { steps: { label: string; done: boolean; current: boolean }[] }) {
  return (
    <ol aria-label="Buyurtma bosqichlari" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {steps.map(s => (
        <li key={s.label} aria-current={s.current ? "step" : undefined} className={cn("flex items-center gap-1", s.done ? "text-muted-foreground" : s.current ? "font-medium text-foreground" : "text-muted-foreground/70")}>
          {s.done ? <CheckIcon aria-hidden="true" className="size-3.5 text-green-600" /> : <span aria-hidden="true" className={cn("mx-1 size-1.5 rounded-full", s.current ? "bg-primary" : "bg-muted-foreground/40")} />}
          {s.label}
          <span className="sr-only">{s.done ? " (bajarildi)" : s.current ? " (hozirgi)" : ""}</span>
        </li>
      ))}
    </ol>
  );
}

type PaymentTarget = { kind: "manual" } | { kind: "month"; id: string };
type ReceiptRef = { kind: "manual" | "month"; id: string; label: string };
type Line = { key: string; label: string; due: string | null; amount: bigint; paid: bigint; state: "paid" | "overdue" | "pending" | "waiting"; receipts: { id: string; kind: "manual" | "month"; text: string; reversed: boolean }[]; pay?: PaymentTarget };
const stateTone = { paid: "success", overdue: "danger", pending: "neutral", waiting: "neutral" } as const;
const stateLabel = { paid: "To‘langan", overdue: "Kechikkan", pending: "Kutilmoqda", waiting: "Jadval yo‘q" } as const;

/** Everything the customer owes and has paid, in one table: initial payment or full payment, then the months. */
export function PaymentsBlock({ progress, cancelled, onPay, onCorrect }: { progress: OrderProgress; cancelled: boolean; onPay: (target: PaymentTarget) => void; onCorrect: (receipt: ReceiptRef) => void }) {
  const pay = progress.payments;
  const terms = pay?.terms;
  if (!pay || !terms) return null;
  const inst = progress.installments;
  const manual = pay.receipts.map(r => ({ id: r.id, kind: "manual" as const, text: `${formatDay(r.received_on)} · ${paymentMethods[r.method] ?? r.method}`, amount: r.amount_uzs, reversed: r.reversed }));
  const manualPaid = BigInt(pay.manual_received_uzs);
  const lines: Line[] = [];
  const receiptText = (r: { text: string; amount: string }) => `${r.text} · ${formatSum(r.amount)}`;
  if (terms.payment_type === "cash") {
    const amount = BigInt(terms.agreed_total_uzs);
    lines.push({ key: "cash", label: "To‘liq to‘lov", due: null, amount, paid: manualPaid, state: manualPaid >= amount ? "paid" : "pending", receipts: manual.map(r => ({ ...r, text: receiptText(r) })), pay: manualPaid < amount && !cancelled ? { kind: "manual" } : undefined });
  } else {
    const initial = BigInt(terms.initial_due_uzs);
    if (initial > zero) lines.push({ key: "initial", label: "Boshlang‘ich to‘lov", due: null, amount: initial, paid: manualPaid, state: manualPaid >= initial ? "paid" : "pending", receipts: manual.map(r => ({ ...r, text: receiptText(r) })), pay: manualPaid < initial && !pay.has_schedule && !cancelled ? { kind: "manual" } : undefined });
    if (inst?.contract)
      for (const row of inst.schedule) {
        const own = inst.receipts.filter(r => r.sequence_no === row.sequence_no).map(r => ({ id: r.id, kind: "month" as const, reversed: r.reversed, text: receiptText({ text: `${formatDay(r.received_on)} · ${paymentMethods[r.method] ?? r.method}`, amount: r.amount_uzs }) }));
        lines.push({ key: row.id, label: `${row.sequence_no}-oy`, due: row.due_date, amount: BigInt(row.amount_uzs), paid: BigInt(row.paid_uzs), state: row.state as Line["state"], receipts: own, pay: row.state !== "paid" && inst.contract.status === "active" && !cancelled ? { kind: "month", id: row.id } : undefined });
      }
    else lines.push({ key: "months", label: `Oylik to‘lovlar, ${terms.term_months} oy`, due: null, amount: BigInt(terms.agreed_total_uzs) - initial, paid: zero, state: "waiting", receipts: [] });
  }
  const total = BigInt(terms.agreed_total_uzs);
  const paid = BigInt(pay.received_uzs);
  const canReview = pay.can_review || !!inst?.can_review;
  return (
    <TableFrame>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>To‘lov</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Summa</TableHead>
            <TableHead className="hidden text-right sm:table-cell">To‘langan</TableHead>
            <TableHead className="text-right">Qoldiq</TableHead>
            <TableHead className="hidden sm:table-cell">Holat</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Amal</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map(line => {
            const live = line.receipts.filter(r => !r.reversed);
            return (
              <TableRow key={line.key}>
                <TableCell className="whitespace-normal">
                  <span className="font-medium">{line.label}</span>
                  {line.due && <span className="text-muted-foreground max-sm:block"><span className="max-sm:hidden"> · </span>{formatDay(line.due)}</span>}
                  <span className="mt-1 block sm:hidden">
                    <StatusBadge tone={stateTone[line.state]}>{stateLabel[line.state]}</StatusBadge>
                  </span>
                  {line.receipts.map(r => (
                    <span key={r.id} className={cn("block text-sm text-muted-foreground tabular-nums", r.reversed && "line-through")}>
                      {r.text}
                      {r.reversed && <span className="sr-only"> (bekor qilingan)</span>}
                    </span>
                  ))}
                </TableCell>
                <TableCell className="hidden text-right align-top sm:table-cell">
                  <Money value={line.amount} />
                </TableCell>
                <TableCell className="hidden text-right align-top sm:table-cell">
                  <Money value={line.paid} />
                </TableCell>
                <TableCell className="text-right align-top font-medium">
                  <Money value={line.amount - line.paid} />
                </TableCell>
                <TableCell className="hidden align-top sm:table-cell">
                  <StatusBadge tone={stateTone[line.state]}>{stateLabel[line.state]}</StatusBadge>
                </TableCell>
                <TableCell className="text-right align-top">
                  <span className="inline-flex items-center justify-end gap-1">
                    {line.pay && (
                      <Button type="button" variant="secondary" aria-label={`${line.label}: to‘lov qo‘shish`} onClick={() => onPay(line.pay!)}>
                        <PlusIcon data-icon="inline-start" />
                        To‘lov
                      </Button>
                    )}
                    {canReview && !cancelled && live.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon" aria-label={`${line.label}: boshqa amallar`} />}>
                          <EllipsisIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-64">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>Xato qaydni tuzatish</DropdownMenuLabel>
                            {live.map(r => (
                              <DropdownMenuItem key={r.id} onClick={() => onCorrect({ kind: r.kind, id: r.id, label: r.text })}>
                                {r.text}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Jami</TableCell>
            <TableCell className="hidden text-right sm:table-cell">
              <Money value={total} />
            </TableCell>
            <TableCell className="hidden text-right sm:table-cell">
              <Money value={paid} />
            </TableCell>
            <TableCell className="text-right">
              <Money value={total - paid} />
            </TableCell>
            <TableCell className="hidden sm:table-cell" />
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </TableFrame>
  );
}

const percent = (bps: number) => (bps / 100).toFixed(bps % 100 ? 1 : 0).replace(".", ",") + "%";

/** Who funded the product and what has come back to each investor. Read-only, always visible once funding exists. */
export function InvestorsBlock({ data }: { data: OrderInvestors | null }) {
  if (!data) return null;
  if (!data.investors.length) return <EmptyState title="Investorlar biriktirilmagan" />;
  const t = data.totals;
  return (
    <>
      {data.initial_mismatch && <Notice>Boshlang‘ich to‘lov investorlarga ulushiga mos taqsimlanmagan. Har bir investorga tegishli summa «kerak» deb ko‘rsatilgan. Tuzatilmaguncha oylik to‘lov qabul qilinmaydi.</Notice>}
      {!data.fully_funded && data.cost && (
        <Notice>
          Tan narxi to‘liq qoplanmagan: <Money value={t.invested_uzs} /> / <Money value={data.cost} />.
        </Notice>
      )}
      {/* Phone: one card per investor, every number visible without sideways scrolling. */}
      <ul className="flex flex-col divide-y rounded-lg border text-sm sm:hidden">
        {data.investors.map(r => {
          const wrong = r.initial_expected_uzs !== null && r.initial_expected_uzs !== r.initial_returned_uzs;
          return (
            <li key={r.account_id} className="flex flex-col gap-2 p-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground tabular-nums">
                  <Money value={r.invested_uzs} /> · {percent(r.share_bps)}
                </span>
              </div>
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                <dt className="text-muted-foreground">Boshlang‘ichdan qaytgan</dt>
                <dd className="text-right">
                  <Money value={r.initial_returned_uzs} className={wrong ? "font-medium text-destructive" : undefined} />
                  {wrong && (
                    <span className="block text-muted-foreground">
                      kerak: <Money value={r.initial_expected_uzs} />
                    </span>
                  )}
                </dd>
                <dt className="text-muted-foreground">Oylikdan qaytgan</dt>
                <dd className="text-right">
                  <Money value={r.monthly_principal_uzs} />
                </dd>
                <dt className="text-muted-foreground">Foyda</dt>
                <dd className="text-right">
                  <Money value={r.profit_uzs} />
                </dd>
                <dt className="text-muted-foreground">Qoldiq</dt>
                <dd className="text-right font-medium">
                  <Money value={r.outstanding_uzs} />
                </dd>
              </dl>
            </li>
          );
        })}
        <li className="flex items-baseline justify-between gap-3 bg-muted/50 p-3 font-medium">
          <span>Jami qoldiq</span>
          <span>
            <Money value={t.outstanding_uzs} /> / <Money value={t.invested_uzs} />
          </span>
        </li>
      </ul>
      <div className="max-sm:hidden">
      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Investor</TableHead>
              <TableHead className="text-right">Qo‘shgan</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Ulush</TableHead>
              <TableHead className="text-right">Boshlang‘ichdan qaytgan</TableHead>
              <TableHead className="text-right">Oylikdan qaytgan</TableHead>
              <TableHead className="text-right">Foyda</TableHead>
              <TableHead className="text-right">Qoldiq</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.investors.map(r => {
              const wrong = r.initial_expected_uzs !== null && r.initial_expected_uzs !== r.initial_returned_uzs;
              return (
                <TableRow key={r.account_id}>
                  <TableCell className="font-medium">
                    {r.name}
                    <span className="block font-normal text-muted-foreground tabular-nums sm:hidden">{percent(r.share_bps)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={r.invested_uzs} />
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{percent(r.share_bps)}</TableCell>
                  <TableCell className="text-right">
                    <Money value={r.initial_returned_uzs} className={wrong ? "font-medium text-destructive" : undefined} />
                    {wrong && (
                      <span className="block text-sm text-muted-foreground">
                        kerak: <Money value={r.initial_expected_uzs} />
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={r.monthly_principal_uzs} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={r.profit_uzs} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <Money value={r.outstanding_uzs} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Jami</TableCell>
              <TableCell className="text-right">
                <Money value={t.invested_uzs} />
              </TableCell>
              <TableCell className="hidden text-right sm:table-cell">100%</TableCell>
              <TableCell className="text-right">
                <Money value={t.initial_returned_uzs} />
              </TableCell>
              <TableCell className="text-right">
                <Money value={t.monthly_principal_uzs} />
              </TableCell>
              <TableCell className="text-right">
                <Money value={t.profit_uzs} />
              </TableCell>
              <TableCell className="text-right">
                <Money value={t.outstanding_uzs} />
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TableFrame>
      </div>
    </>
  );
}

const eventLabels: Record<string, string> = {
  request_created: "Buyurtma yaratildi",
  "request_status:in_progress": "Qabul qilindi",
  "request_status:new": "«Yangi» holatiga qaytarildi",
  "request_status:cancelled": "Bekor qilindi",
  customer_linked: "Mijoz biriktirildi",
  payment_terms_saved: "To‘lov shartlari saqlandi",
  manual_receipt_recorded: "To‘lov qayd etildi",
  manual_receipt_reversed: "To‘lov qaydi bekor qilindi",
  funding_allocations_saved: "Investorlar biriktirildi",
  sale_confirmed: "Sotuv tasdiqlandi",
  "fulfillment:in_transit": "Yo‘lga chiqdi",
  "fulfillment:delivered": "Yetkazildi",
  "fulfillment:not_delivered": "Yetkazilmagan deb belgilandi",
  initial_capital_return_posted: "Boshlang‘ich to‘lov investorlarga qaytarildi",
  initial_capital_return_rebalanced: "Qaytim taqsimoti tuzatildi",
  installment_schedule_activated: "Nasiya jadvali yaratildi",
  installment_receipt_recorded: "Oylik to‘lov qayd etildi",
  installment_receipt_reversed: "Oylik to‘lov qaydi bekor qilindi",
};

/** What was done on the order, newest first. */
export function HistoryBlock({ events }: { events: OrderEvent[] | null }) {
  const [all, setAll] = useState(false);
  if (!events?.length) return null;
  const shown = all ? events : events.slice(0, 5);
  return (
    <Block title="Tarix">
      <ul className="flex flex-col divide-y rounded-lg border text-sm">
        {shown.map(e => (
          <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-2">
            <span>{eventLabels[e.action] ?? e.action}</span>
            <span className="text-muted-foreground tabular-nums">
              {formatStamp(e.created_at)}
              {e.actor_role && e.actor_role in roleLabels ? " · " + roleLabels[e.actor_role as StaffRole] : ""}
            </span>
          </li>
        ))}
      </ul>
      {events.length > shown.length && (
        <Button type="button" variant="ghost" className="self-start" onClick={() => setAll(true)}>
          Yana {events.length - shown.length} ta
        </Button>
      )}
    </Block>
  );
}
