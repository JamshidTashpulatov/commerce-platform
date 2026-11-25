"use client";

import { WrenchIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog, EmptyState, ErrorState, InlineError, LoadingBlock, Money, MoneyInput, Notice, RefreshButton, Section, Stat, StatGrid, SubmitButton, SummaryList, TableFrame, TextField, errorText, formatDay, tashkentToday } from "./kit";
import { ReceiptCorrectionDialog } from "./receipt-correction";
import { RecordBadge } from "./status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { minimumInitial, priceInstallment, type PricingPolicy } from "@/lib/installment-pricing";
import { staffFetch } from "@/lib/staff-client";

type Terms = { agreed_total_uzs: string; payment_type: "cash" | "installment"; initial_due_uzs: string; cost_uzs: string | null; financed_principal_uzs: string | null; markup_uzs: string | null; term_months: number | null; minimum_initial_bps: number | null; monthly_markup_bps: number | null };
type Receipt = { id: string; amount_uzs: string; kind: "cash" | "initial"; method: string; received_on: string; reversed: boolean };
type PaymentData = { can_review: boolean; terms: Terms | null; receipts: Receipt[]; received_uzs: string; remaining_uzs: string | null; manual_received_uzs: string; has_schedule: boolean; pricing_policy: PricingPolicy | null };
export const paymentMethods: Record<string, string> = { cash: "Naqd", transfer: "Pul o‘tkazmasi", other: "Boshqa" };
const validSum = (s: string) => /^(0|[1-9][0-9]{0,8})$/.test(s);

export function OrderPayments({ endpoint, cancelled, onChanged, plain, part }: { plain?: boolean; part?: "terms" | "receipts"; endpoint: string; cancelled: boolean; onChanged?: () => void }) {
  const url = endpoint + "/payments";
  const [data, setData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [total, setTotal] = useState("");
  const [type, setType] = useState<"cash" | "installment">("cash");
  const [initial, setInitial] = useState("0");
  const [cost, setCost] = useState("");
  const [months, setMonths] = useState(6);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState("");
  const [confirmReceipt, setConfirmReceipt] = useState(false);
  const [correcting, setCorrecting] = useState<Receipt | null>(null);
  const [correctionError, setCorrectionError] = useState("");
  const key = useRef("");
  const pending = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const d = await staffFetch<PaymentData>(url);
      setData(d);
      setTotal(d.terms?.agreed_total_uzs ?? "");
      setType(d.terms?.payment_type ?? "cash");
      setInitial(d.terms?.initial_due_uzs ?? "0");
      setCost(d.terms?.cost_uzs ?? "");
      setMonths(d.terms?.term_months ?? 6);
    } catch (e) {
      setData(null);
      setLoadError(errorText(e, "To‘lovlar yuklanmadi"));
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    setDate(tashkentToday());
    void load();
  }, [load]);

  async function post(body: Record<string, unknown>, success: string, report: (message: string) => void = setError) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setCorrectionError("");
    try {
      await staffFetch(body.action === "review" ? endpoint + "/reviews" : url, "POST", body);
      toast.success(success);
      if (body.action === "receipt") {
        setAmount("");
        key.current = "";
      }
      setConfirmReceipt(false);
      setCorrecting(null);
      await load();
      onChanged?.();
    } catch (e) {
      setConfirmReceipt(false);
      report(errorText(e, "Saqlash imkoni bo‘lmadi"));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const locked = !!data?.receipts.length || !!data?.has_schedule || cancelled;
  const editable = !locked && !busy;
  const policy = locked && data?.terms?.minimum_initial_bps != null && data.terms.monthly_markup_bps != null ? { minimumInitialBps: data.terms.minimum_initial_bps, monthlyMarkupBps: data.terms.monthly_markup_bps } : data?.pricing_policy;
  let quote: ReturnType<typeof priceInstallment> | null = null;
  if (type === "installment" && policy && validSum(cost) && validSum(initial))
    try {
      quote = priceInstallment(BigInt(cost), BigInt(initial), months, policy);
    } catch {}
  // The configured minimum is only the suggested initial payment; the seller may agree on less, or on none.
  const suggested = type === "installment" && policy && validSum(cost) && BigInt(cost) > BigInt(0) ? minimumInitial(BigInt(cost), policy) : null;
  const initialBad = type === "installment" && validSum(cost) && validSum(initial) && BigInt(cost) > BigInt(0) && BigInt(initial) >= BigInt(cost);
  const cashCostBad = type === "cash" && cost !== "" && !(validSum(cost) && BigInt(cost) > BigInt(0));
  const canSave = editable && (type === "cash" ? validSum(total) && BigInt(total) > BigInt(0) && !cashCostBad : !!quote);
  const cap = data?.terms ? BigInt(data.terms.payment_type === "cash" ? data.terms.agreed_total_uzs : data.terms.initial_due_uzs) - BigInt(data.manual_received_uzs) : BigInt(0);
  const amountOver = validSum(amount) && BigInt(amount) > cap;
  const canReceipt = !busy && !cancelled && !data?.has_schedule && !!data?.terms && validSum(amount) && BigInt(amount) > BigInt(0) && BigInt(amount) <= cap && !!date;

  return (
    <Section plain={plain} title="To‘lov shartlari va to‘lovlar" description="Tizimdan tashqarida olingan to‘lovlar qo‘lda qayd etiladi. Bu pul o‘tkazmasi emas." action={<RefreshButton busy={loading || busy} onClick={() => void load()} />}>
      {loading ? (
        <LoadingBlock label="To‘lovlar yuklanmoqda" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => void load()} />
      ) : data ? (
        <>
          {part !== "receipts" && (
          <form
            className="flex flex-col gap-4"
            onSubmit={e => {
              e.preventDefault();
              if (canSave) void post({ action: "terms", total, type, cost, months, initial: type === "cash" ? "0" : initial }, "To‘lov shartlari saqlandi.");
            }}
          >
            <h3 className="text-sm font-medium">Kelishilgan shartlar</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField label="To‘lov turi">
                {id => (
                  <NativeSelect id={id} name="type" className="w-full" value={type} disabled={!editable} onChange={e => setType(e.target.value as "cash" | "installment")}>
                    <NativeSelectOption value="cash">To‘liq to‘lov</NativeSelectOption>
                    <NativeSelectOption value="installment">Nasiya</NativeSelectOption>
                  </NativeSelect>
                )}
              </TextField>
              {type === "cash" && (
                <>
                  <TextField label="Kelishilgan jami summa">{id => <MoneyInput id={id} name="total" value={total} disabled={!editable} onChange={setTotal} />}</TextField>
                  <TextField label="Tan narxi" description="Investorlarni biriktirish uchun kerak." error={cashCostBad ? "Tan narxini to‘g‘ri kiriting." : undefined}>
                    {id => <MoneyInput id={id} name="cost" value={cost} disabled={!editable} onChange={setCost} />}
                  </TextField>
                </>
              )}
              {type === "installment" && (
                <>
                  <TextField label="Tan narxi">
                    {id => (
                      <MoneyInput
                        id={id}
                        name="cost"
                        value={cost}
                        disabled={!editable}
                        onChange={value => {
                          setCost(value);
                          if (policy && validSum(value) && BigInt(value) > BigInt(0)) setInitial(minimumInitial(BigInt(value), policy).toString());
                        }}
                      />
                    )}
                  </TextField>
                  <TextField label="Boshlang‘ich to‘lov" description={suggested !== null && !locked ? <>Tavsiya: <Money value={suggested} /> ({policy!.minimumInitialBps / 100}%). Kamroq yoki 0 ham mumkin.</> : undefined} error={initialBad ? "Tan narxidan kam bo‘lishi kerak." : undefined}>{id => <MoneyInput id={id} name="initial" value={initial} disabled={!editable} onChange={setInitial} />}</TextField>
                  <TextField label="Muddat, oy">{id => <Input id={id} name="months" type="number" inputMode="numeric" min={1} max={60} value={months} disabled={!editable} onChange={e => setMonths(Number(e.target.value))} />}</TextField>
                </>
              )}
            </div>
            {type === "installment" &&
              (!policy ? (
                <Notice>Nasiya stavkalari serverda sozlanmagan.</Notice>
              ) : quote ? (
                <SummaryList
                  rows={[
                    ["Qolgan tan narxi", <Money key="a" value={quote.principal} />],
                    ["Jami ustama", <Money key="b" value={quote.markup} />],
                    ["Jami nasiya qiymati", <Money key="c" value={quote.total} />],
                  ]}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Tavsiya etilgan boshlang‘ich to‘lov {policy.minimumInitialBps / 100}%, ustama oyiga {policy.monthlyMarkupBps / 100}%.
                </p>
              ))}
            {locked ? (
              <p className="text-sm text-muted-foreground">To‘lov qayd etilgach yoki buyurtma bekor qilinsa, shartlar bloklanadi.</p>
            ) : (
              <SubmitButton variant="outline" busy={busy} disabled={!canSave} className="self-start">
                Shartlarni saqlash
              </SubmitButton>
            )}
          </form>
          )}

          <InlineError message={error} />

          {part !== "terms" && (
            <>
          {data.terms && (
            <>
              <StatGrid className="xl:grid-cols-3">
                <Stat label="Qayd etilgan tushum" value={<Money value={data.received_uzs} />} />
                <Stat label="Umumiy qoldiq" value={<Money value={data.remaining_uzs ?? "0"} />} />
                {data.terms.payment_type === "installment" && <Stat label="Boshlang‘ich to‘lov qoldig‘i" value={<Money value={cap} />} />}
              </StatGrid>
              {!data.has_schedule && !cancelled && cap > BigInt(0) && (
                <form
                  className="flex flex-col gap-4 rounded-lg border p-3"
                  onSubmit={e => {
                    e.preventDefault();
                    if (canReceipt) setConfirmReceipt(true);
                  }}
                >
                  <h3 className="text-sm font-medium">{data.terms.payment_type === "installment" ? "Boshlang‘ich to‘lovni qayd etish" : "To‘lovni qayd etish"}</h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <TextField label="Olingan summa" error={amountOver ? "Summa qoldiqdan oshmasligi kerak." : undefined}>
                      {id => (
                        <MoneyInput
                          id={id}
                          name="amount"
                          value={amount}
                          disabled={busy}
                          aria-invalid={amountOver || undefined}
                          onChange={value => {
                            setAmount(value);
                            key.current = "";
                          }}
                        />
                      )}
                    </TextField>
                    <TextField label="To‘lov sanasi">
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
                    <TextField label="To‘lov usuli">
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
                  <SubmitButton disabled={!canReceipt} className="self-start">
                    To‘lovni qayd etish
                  </SubmitButton>
                </form>
              )}
              {data.terms.payment_type === "installment" && <p className="text-sm text-muted-foreground">Oylik to‘lovlar quyidagi «Nasiya jadvali» bo‘limida qayd etiladi.</p>}
            </>
          )}

          <h3 className="text-sm font-medium">To‘lovlar tarixi</h3>
          {data.receipts.length ? (
            <TableFrame>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sana</TableHead>
                    <TableHead className="text-right">Summa</TableHead>
                    <TableHead>Turi</TableHead>
                    <TableHead>Usul</TableHead>
                    <TableHead>Holat</TableHead>
                    {data.can_review && <TableHead className="text-right">Amal</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.receipts.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{formatDay(r.received_on)}</TableCell>
                      <TableCell className="text-right">
                        <Money value={r.amount_uzs} />
                      </TableCell>
                      <TableCell>{r.kind === "initial" ? "Boshlang‘ich" : "To‘liq to‘lov"}</TableCell>
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
                                setCorrectionError("");
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
          ) : (
            <EmptyState title="Hozircha to‘lov qayd etilmagan" description={data.terms ? undefined : "Avval kelishilgan shartlarni saqlang."} />
          )}
            </>
          )}

          <ConfirmDialog
            open={confirmReceipt}
            onOpenChange={setConfirmReceipt}
            title="To‘lovni qayd etasizmi?"
            description="Qayd kassa hisobotiga tushadi. Xato bo‘lsa, uni faqat administrator tuzata oladi."
            confirmLabel="Qayd etish"
            busy={busy}
            onConfirm={() => {
              key.current ||= crypto.randomUUID();
              void post({ action: "receipt", amount, method, date, key: key.current }, "To‘lov qayd etildi.");
            }}
          >
            <SummaryList
              rows={[
                ["Summa", <Money key="a" value={amount || "0"} />],
                ["Sana", formatDay(date)],
                ["Usul", paymentMethods[method]],
              ]}
            />
          </ConfirmDialog>

          <ReceiptCorrectionDialog
            open={!!correcting}
            busy={busy}
            error={correctionError}
            summary={
              correcting && (
                <>
                  {formatDay(correcting.received_on)} · <Money value={correcting.amount_uzs} /> · {correcting.kind === "initial" ? "Boshlang‘ich to‘lov" : "To‘liq to‘lov"}
                </>
              )
            }
            onClose={() => setCorrecting(null)}
            onReverse={reason => correcting && void post({ action: "reverse", receiptId: correcting.id, reason }, "To‘lov qaydi bekor qilindi.", setCorrectionError)}
            onReview={reason => correcting && void post({ action: "review", kind: "manual", receiptId: correcting.id, reason }, "Tafovut kassadagi tekshiruvlar ro‘yxatiga yozildi.", setCorrectionError)}
          />
        </>
      ) : null}
    </Section>
  );
}
