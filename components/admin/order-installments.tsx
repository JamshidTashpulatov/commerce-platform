"use client";

import { PlusIcon, WrenchIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog, EmptyState, ErrorState, InlineError, LoadingBlock, Money, MoneyInput, Notice, RefreshButton, Section, StatusBadge, SummaryList, TableFrame, TextField, errorText, formatDay, formatSum, tashkentToday } from "./kit";
import { paymentMethods } from "./order-payments";
import { ReceiptCorrectionDialog } from "./receipt-correction";
import { RecordBadge } from "./status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildSchedule } from "@/lib/installment-schedule";
import { remainingBalance, spreadPayment, type SpreadPart } from "@/lib/installment-spread";
import { staffFetch } from "@/lib/staff-client";

type Row = { id: string; sequence_no: number; due_date: string; amount_uzs: string; paid_uzs: string; state: string };
type MonthlyReceipt = { id: string; payment_key: string | null; sequence_no: number; amount_uzs: string; received_on: string; method: string; principal_uzs: string | null; profit_uzs: string | null; reversed: boolean };
type Data = { can_review: boolean; terms: { agreed_total_uzs: string; initial_due_uzs: string; payment_type: string; term_months: number | null } | null; initial_received_uzs: string; has_passport: boolean; contract: { id: string; status: string } | null; schedule: Row[]; receipts: MonthlyReceipt[] };
const stateTone = { paid: "success", overdue: "danger", pending: "neutral" } as const;
const stateLabels: Record<string, string> = { paid: "To‘langan", overdue: "Kechikkan", pending: "Kutilmoqda" };

export function OrderInstallments({ endpoint, cancelled, onChanged, version = 0, plain }: { plain?: boolean; version?: number; endpoint: string; cancelled: boolean; onChanged: () => void }) {
  const url = endpoint + "/installments";
  const [data, setData] = useState<Data | null>(null);
  const [months, setMonths] = useState(6);
  const [first, setFirst] = useState("");
  const [selected, setSelected] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [method, setMethod] = useState("cash");
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [correcting, setCorrecting] = useState<MonthlyReceipt | null>(null);
  const key = useRef("");
  const pending = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const d = await staffFetch<Data>(url);
      setData(d);
      if (d.terms?.term_months) setMonths(d.terms.term_months);
    } catch (e) {
      setData(null);
      setLoadError(errorText(e, "Jadvalni yuklab bo‘lmadi"));
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    setDate(tashkentToday());
    void load();
  }, [load, version]);

  async function post(body: Record<string, unknown>, success: string, report: (message: string) => void = setError) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setDialogError("");
    try {
      await staffFetch(body.action === "review" ? endpoint + "/reviews" : url, "POST", body);
      toast.success(success);
      setConfirm(false);
      setSelected("");
      setAmount("");
      key.current = "";
      setCorrecting(null);
      await load();
      onChanged();
    } catch (e) {
      setConfirm(false);
      report(errorText(e, "Amal bajarilmadi"));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const t = data?.terms;
  let preview: ReturnType<typeof buildSchedule> = [];
  if (t && first)
    try {
      preview = buildSchedule(BigInt(t.agreed_total_uzs), BigInt(t.initial_due_uzs), months, first);
    } catch {}
  const initialPaid = !!t && data?.initial_received_uzs === t.initial_due_uzs;
  const ready = !!t && t.payment_type === "installment" && data?.has_passport && initialPaid && t.term_months === months && preview.length > 0 && !cancelled;
  const row = data?.schedule.find(r => r.id === selected);
  const cap = row ? BigInt(row.amount_uzs) - BigInt(row.paid_uzs) : BigInt(0);
  const amountOk = /^[1-9][0-9]{0,8}$/.test(amount);
  // A payment may be larger than the month's balance: the excess goes to the following months.
  const balances = (data?.schedule ?? []).map(r => ({ id: r.id, sequence_no: r.sequence_no, balance: BigInt(r.amount_uzs) - BigInt(r.paid_uzs) }));
  const owed = remainingBalance(balances);
  let spread: SpreadPart[] = [];
  if (row && amountOk)
    try {
      spread = spreadPayment(BigInt(amount), balances, row.id);
    } catch {}
  const overContract = amountOk && BigInt(amount) > owed;
  const canPay = !!row && amountOk && spread.length > 0 && !!date && !busy && !cancelled;
  // Every month row of the payment being corrected: a payment spread over months is reversed as a whole.
  const correctingGroup = correcting ? (correcting.payment_key ? (data?.receipts ?? []).filter(r => r.payment_key === correcting.payment_key) : [correcting]) : [];

  if ((!loading || data) && !loadError && t?.payment_type !== "installment") return null;
  return (
    <Section plain={plain} title="Nasiya jadvali" description="Oylik to‘lov qayd etilganda tizim uni asosiy kapital va foydaga o‘zi ajratadi." action={<RefreshButton busy={loading || busy} onClick={() => void load()} />}>
      {loading && !data ? (
        <LoadingBlock label="Jadval yuklanmoqda" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => void load()} />
      ) : data && t?.payment_type === "installment" ? (
        !data.contract ? (
          <>
            <p className="text-sm text-muted-foreground">Jadval kelishilgan jami summadan boshlang‘ich to‘lov ayirilgach tuziladi. Ustama avval saqlangan nasiya qiymatiga kiritilgan.</p>
            <ul className="flex flex-col gap-1.5 text-sm">
              <li className="flex items-center gap-2">
                <StatusBadge tone={data.has_passport ? "success" : "warning"}>{data.has_passport ? "Tayyor" : "Kerak"}</StatusBadge>
                {data.has_passport ? "Pasport ma’lumoti mavjud mijoz biriktirilgan." : "Pasport ma’lumoti mavjud mijozni biriktiring."}
              </li>
              <li className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={initialPaid ? "success" : "warning"}>{initialPaid ? "Tayyor" : "Kerak"}</StatusBadge>
                {t.initial_due_uzs === "0" ? (
                  <span>Boshlang‘ich to‘lovsiz nasiya: butun summa oylik to‘lovlarga bo‘linadi.</span>
                ) : (
                  <span>
                    Boshlang‘ich to‘lov: <Money value={data.initial_received_uzs} /> / <Money value={t.initial_due_uzs} />
                  </span>
                )}
              </li>
            </ul>
            <div className="grid gap-4 sm:grid-cols-2 lg:max-w-md">
              <TextField label="Muddat, oy">{id => <Input id={id} name="months" type="number" value={months} readOnly />}</TextField>
              <TextField label="Birinchi to‘lov sanasi">{id => <Input id={id} name="firstDate" type="date" value={first} disabled={busy} onChange={e => setFirst(e.target.value)} />}</TextField>
            </div>
            {preview.length > 0 && (
              <TableFrame>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Oy</TableHead>
                      <TableHead>Sana</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map(r => (
                      <TableRow key={r.sequence_no}>
                        <TableCell>{r.sequence_no}</TableCell>
                        <TableCell>{formatDay(r.due_date)}</TableCell>
                        <TableCell className="text-right">
                          <Money value={r.amount_uzs} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableFrame>
            )}
            <InlineError message={error} />
            <Button type="button" className="self-start" disabled={!ready || busy} onClick={() => setConfirm(true)}>
              Jadvalni yaratish
            </Button>
            <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Jadvalni tasdiqlaysizmi?" description="Jadval saqlangach shartlar va boshlang‘ich to‘lov qaydlari bloklanadi." confirmLabel="Jadvalni tasdiqlash" busy={busy} disabled={!ready} onConfirm={() => void post({ action: "activate", months, firstDate: first }, "Jadval faollashtirildi.")}>
              <SummaryList
                rows={[
                  ["Muddat", months + " oy"],
                  ["Birinchi to‘lov", formatDay(first)],
                ]}
              />
            </ConfirmDialog>
          </>
        ) : (
          <>
            <div>
              <StatusBadge tone={data.contract.status === "settled" ? "success" : "info"}>{data.contract.status === "settled" ? "Yakunlangan" : "Faol jadval"}</StatusBadge>
            </div>
            <InlineError message={error} />
            <TableFrame>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Oy</TableHead>
                    <TableHead>Sana</TableHead>
                    <TableHead className="text-right">Summa</TableHead>
                    <TableHead className="text-right">Qoldiq</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead className="text-right">Amal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.schedule.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{r.sequence_no}</TableCell>
                      <TableCell>{formatDay(r.due_date)}</TableCell>
                      <TableCell className="text-right">
                        <Money value={r.amount_uzs} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={BigInt(r.amount_uzs) - BigInt(r.paid_uzs)} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={stateTone[r.state as keyof typeof stateTone] ?? "neutral"}>{stateLabels[r.state] ?? r.state}</StatusBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.state !== "paid" && data.contract?.status === "active" && !cancelled && (
                          <Button
                            type="button"
                            variant="secondary"
                           
                            disabled={busy}
                            onClick={() => {
                              setSelected(r.id);
                              setAmount((BigInt(r.amount_uzs) - BigInt(r.paid_uzs)).toString());
                              setDialogError("");
                              key.current = "";
                            }}
                          >
                            <PlusIcon data-icon="inline-start" />
                            To‘lov qo‘shish
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableFrame>

            <h3 className="text-sm font-medium">Oylik to‘lovlar tarixi</h3>
            {data.receipts.length ? (
              <>
                <TableFrame>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Oy</TableHead>
                        <TableHead>Sana</TableHead>
                        <TableHead className="text-right">Summa</TableHead>
                        <TableHead className="text-right">Asosiy kapital</TableHead>
                        <TableHead className="text-right">Foyda</TableHead>
                        <TableHead>Usul</TableHead>
                        <TableHead>Holat</TableHead>
                        {data.can_review && <TableHead className="text-right">Amal</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.receipts.map(r => (
                        <TableRow key={r.id}>
                          <TableCell>{r.sequence_no}</TableCell>
                          <TableCell>{formatDay(r.received_on)}</TableCell>
                          <TableCell className="text-right font-medium">
                            <Money value={r.amount_uzs} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Money value={r.principal_uzs} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Money value={r.profit_uzs} />
                          </TableCell>
                          <TableCell>{paymentMethods[r.method] ?? r.method}</TableCell>
                          <TableCell>
                            <RecordBadge reversed={r.reversed} />
                          </TableCell>
                          {data.can_review && (
                            <TableCell className="text-right">
                              {!r.reversed && !cancelled && (
                                <Button
                                  type="button"
                                  variant="secondary"
                                 
                                  disabled={busy}
                                  onClick={() => {
                                    setDialogError("");
                                    setCorrecting(r);
                                  }}
                                >
                                  <WrenchIcon data-icon="inline-start" />
                                  Tuzatish
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableFrame>
                <p className="text-sm text-muted-foreground">Asosiy kapital va foyda tizim tomonidan hisoblanadi va faqat shu buyurtmani moliyalashtirgan investorlarga, ulushiga mutanosib yoziladi. Chiziqcha: taqsimot hali hisoblanmagan.</p>
              </>
            ) : (
              <EmptyState title="Hozircha oylik to‘lovlar yo‘q" />
            )}

            <Dialog open={!!row} onOpenChange={next => !next && !busy && setSelected("")}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{row?.sequence_no}-oy to‘lovi</DialogTitle>
                  <DialogDescription>
                    Muddat: {formatDay(row?.due_date)}. Shu oy qoldig‘i: <Money value={cap} />, shartnoma bo‘yicha jami qarz: <Money value={owed} />. Tizim to‘lovni asosiy kapital va foydaga o‘zi ajratadi.
                  </DialogDescription>
                </DialogHeader>
                <form
                  id="monthly-receipt"
                  className="grid gap-4"
                  onSubmit={e => {
                    e.preventDefault();
                    if (!canPay || !row) return;
                    key.current ||= crypto.randomUUID();
                    void post({ action: "receipt", scheduleId: row.id, amount, date, method, key: key.current }, "Oylik to‘lov qayd etildi.", setDialogError);
                  }}
                >
                  <TextField label="Summa" description="Shu oy qoldig‘idan ko‘p bo‘lsa, ortig‘i keyingi oylarga o‘tadi." error={overContract ? `Summa shartnomaning qolgan qarzidan (${formatSum(owed)}) oshmasligi kerak.` : undefined}>
                    {id => (
                      <MoneyInput
                        id={id}
                        name="amount"
                        value={amount}
                        disabled={busy}
                        onChange={value => {
                          setAmount(value);
                          key.current = "";
                        }}
                      />
                    )}
                  </TextField>
                  <div className="grid grid-cols-2 gap-4">
                    <TextField label="Sana">
                      {id => (
                        <Input
                          id={id}
                          name="date"
                          type="date"
                          value={date}
                          disabled={busy}
                          onChange={e => {
                            setDate(e.target.value);
                            key.current = "";
                          }}
                        />
                      )}
                    </TextField>
                    <TextField label="Usul">
                      {id => (
                        <NativeSelect
                          id={id}
                          name="method"
                          className="w-full"
                          value={method}
                          disabled={busy}
                          onChange={e => {
                            setMethod(e.target.value);
                            key.current = "";
                          }}
                        >
                          {Object.entries(paymentMethods).map(([k, v]) => (
                            <NativeSelectOption key={k} value={k}>
                              {v}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      )}
                    </TextField>
                  </div>
                  {spread.length > 1 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm font-medium">To‘lov oylarga shunday bo‘linadi</p>
                      <SummaryList rows={spread.map(p => [p.sequence_no + "-oy", <Money key={p.id} value={p.amount} />])} />
                    </div>
                  )}
                  <InlineError message={dialogError} />
                </form>
                <DialogFooter>
                  <Button type="button" variant="outline" disabled={busy} onClick={() => setSelected("")}>
                    Ortga
                  </Button>
                  <Button type="submit" form="monthly-receipt" disabled={!canPay}>
                    {busy && <Spinner data-icon="inline-start" />}
                    To‘lovni qayd etish
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <ReceiptCorrectionDialog
              open={!!correcting}
              busy={busy}
              error={dialogError}
              summary={
                correcting && (
                  <>
                    {correctingGroup.length > 1 ? (
                      <>
                        {formatDay(correcting.received_on)} · <Money value={correctingGroup.reduce((n, r) => n + BigInt(r.amount_uzs), BigInt(0))} /> · {correctingGroup.map(r => r.sequence_no).sort((a, b) => a - b).join(", ")}-oylarga bo‘lingan bitta to‘lov. Bekor qilinsa, hammasi birga bekor bo‘ladi.
                      </>
                    ) : (
                      <>
                        {correcting.sequence_no}-oy · {formatDay(correcting.received_on)} · <Money value={correcting.amount_uzs} />
                      </>
                    )}
                  </>
                )
              }
              onClose={() => setCorrecting(null)}
              onReverse={reason => correcting && void post({ action: "reverse", receiptId: correcting.id, reason }, "Qayd bekor qilindi.", setDialogError)}
              onReview={reason => correcting && void post({ action: "review", kind: "monthly", receiptId: correcting.id, reason }, "Tafovut kassadagi tekshiruvlar ro‘yxatiga yozildi.", setDialogError)}
            />
          </>
        )
      ) : (
        <Notice>Nasiya shartlari topilmadi.</Notice>
      )}
    </Section>
  );
}
