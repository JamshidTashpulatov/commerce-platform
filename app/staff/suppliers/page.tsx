"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmDialog, EmptyState, ErrorState, InlineError, LoadingBlock, Money, MoneyInput, Notice, PageHeader, RefreshButton, Section, StatusBadge, SubmitButton, SummaryList, TableFrame, TextField, errorText, formatDay, isAmount, tashkentToday } from "@/components/admin/kit";
import { RecordBadge } from "@/components/admin/status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { staffFetch } from "@/lib/staff-client";

type Supplier = { id: string; display_name: string; total_uzs: string; paid_uzs: string; outstanding_uzs: string };
type Invoice = { id: string; supplier_id: string; display_name: string; reference: string | null; amount_uzs: string; paid_uzs: string; outstanding_uzs: string; due_date: string | null; status: string };
type Payment = { id: string; invoice_id: string; amount_uzs: string; paid_on: string; method: string | null; reversed: boolean };
type Data = { suppliers: Supplier[]; invoices: Invoice[]; payments: Payment[]; truncated: boolean; enabled: boolean };
const statuses: Record<string, string> = { paid: "To‘langan", open: "Ochiq", overdue: "Muddati o‘tgan" };
const statusTone = { paid: "success", open: "neutral", overdue: "danger" } as const;
const methods: Record<string, string> = { cash: "Naqd", transfer: "O‘tkazma", other: "Boshqa" };
type Pending = { body: Record<string, unknown>; reset: () => void; title: string; description: string; label: string; rows: [string, ReactNode][] };

export default function Suppliers() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [cost, setCost] = useState("");
  const [reference, setReference] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [method, setMethod] = useState("cash");
  const [reverseId, setReverseId] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState<Pending | null>(null);
  const pending = useRef(false);
  const last = useRef<{ signature: string; key: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setData(await staffFetch<Data>("/api/admin/suppliers"));
    } catch (e) {
      setData(null);
      setLoadError(errorText(e, "Yuklanmadi"));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    setDate(tashkentToday());
    void load();
  }, [load]);

  const enabled = !!data?.enabled && !loading && !busy;
  const invoice = data?.invoices.find(i => i.id === invoiceId);
  const reversing = data?.payments.find(p => p.id === reverseId);
  const invoiceLabel = (id: string) => {
    const i = data?.invoices.find(x => x.id === id);
    return i ? `${i.display_name} · ${i.reference || i.id.slice(0, 8)}` : id.slice(0, 8);
  };

  async function post(body: Record<string, unknown>, reset: () => void) {
    if (!enabled || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const signature = JSON.stringify(body);
      if (last.current?.signature !== signature) last.current = { signature, key: crypto.randomUUID() };
      await staffFetch("/api/admin/suppliers", "POST", { ...body, key: last.current.key });
      last.current = null;
      reset();
      setConfirm(null);
      setReverseId("");
      await load();
      toast.success("Qayd saqlandi.");
    } catch (e) {
      setConfirm(null);
      setReverseId("");
      setError(errorText(e, "Saqlanmadi"));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const overPay = !!invoice && isAmount(amount) && BigInt(amount) > BigInt(invoice.outstanding_uzs);
  const payable = data?.invoices.filter(i => BigInt(i.outstanding_uzs) > BigInt(0)) ?? [];

  return (
    <>
      <PageHeader title="Yetkazib beruvchilar" description="Tovar xaridi va ta’minotchiga amalda to‘langan mablag‘ shu yerda qayd etiladi. Pul o‘tkazilmaydi.">
        <RefreshButton busy={loading || busy} onClick={() => void load()} />
      </PageHeader>
      {loading && !data ? (
        <LoadingBlock rows={6} label="Yuklanmoqda" />
      ) : !data ? (
        <ErrorState message={loadError || "Yuklanmadi"} onRetry={() => void load()} />
      ) : (
        <>
          {!data.enabled && <Notice>Qayd kiritish server sozlamalarida o‘chirilgan. Ma’lumotlarni faqat ko‘rish mumkin.</Notice>}
          {data.truncated && <Notice>Ro‘yxatlar 200 ta qayd bilan cheklangan.</Notice>}
          <InlineError message={error} />
          <Tabs defaultValue="suppliers">
            <TabsList className="max-w-full overflow-x-auto">
              <TabsTrigger value="suppliers">Ta’minotchilar</TabsTrigger>
              <TabsTrigger value="invoices">Xaridlar</TabsTrigger>
              <TabsTrigger value="payments">To‘lovlar</TabsTrigger>
            </TabsList>

            <TabsContent value="suppliers" className="flex flex-col gap-5">
              <Section title="Yangi yetkazib beruvchi">
                <form
                  className="flex flex-col gap-3 sm:flex-row sm:items-end"
                  onSubmit={e => {
                    e.preventDefault();
                    void post({ action: "supplier", name }, () => setName(""));
                  }}
                >
                  <TextField label="Nomi" className="sm:max-w-sm">
                    {id => <Input id={id} name="name" required minLength={2} maxLength={120} value={name} disabled={!enabled} onChange={e => setName(e.target.value)} />}
                  </TextField>
                  <SubmitButton busy={busy && !confirm && !reverseId} disabled={!enabled || name.trim().length < 2}>
                    Qo‘shish
                  </SubmitButton>
                </form>
              </Section>
              <Section title="Hisobot">
                {data.suppliers.length ? (
                  <TableFrame>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nomi</TableHead>
                          <TableHead className="text-right">Jami xarid</TableHead>
                          <TableHead className="text-right">To‘langan</TableHead>
                          <TableHead className="text-right">Qarz</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.suppliers.map(s => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.display_name}</TableCell>
                            <TableCell className="text-right">
                              <Money value={s.total_uzs} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Money value={s.paid_uzs} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Money value={s.outstanding_uzs} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableFrame>
                ) : (
                  <EmptyState title="Yetkazib beruvchilar yo‘q" description="Birinchi ta’minotchini yuqorida qo‘shing." />
                )}
              </Section>
            </TabsContent>

            <TabsContent value="invoices" className="flex flex-col gap-5">
              <Section title="Xaridni qayd etish" description="Xarid ta’minotchi oldidagi qarzni oshiradi.">
                {!data.suppliers.length ? (
                  <EmptyState title="Avval yetkazib beruvchi qo‘shing" />
                ) : (
                  <form
                    className="flex flex-col gap-4"
                    onSubmit={e => {
                      e.preventDefault();
                      if (!enabled || !supplierId || !isAmount(cost)) return;
                      setConfirm({
                        body: { action: "invoice", supplierId, amount: cost, reference, dueDate: dueDate || null },
                        reset: () => {
                          setCost("");
                          setReference("");
                          setDueDate("");
                        },
                        title: "Xaridni qayd etasizmi?",
                        description: "Ta’minotchi oldidagi qarz shu summaga oshadi.",
                        label: "Xaridni qayd etish",
                        rows: [
                          ["Yetkazib beruvchi", data.suppliers.find(s => s.id === supplierId)?.display_name ?? "—"],
                          ["Qiymat", <Money key="a" value={cost} />],
                          ["Hujjat", reference || "—"],
                          ["To‘lov muddati", formatDay(dueDate)],
                        ],
                      });
                    }}
                  >
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <TextField label="Yetkazib beruvchi">
                        {id => (
                          <NativeSelect id={id} name="supplierId" className="w-full" required value={supplierId} disabled={!enabled} onChange={e => setSupplierId(e.target.value)}>
                            <NativeSelectOption value="">Tanlang</NativeSelectOption>
                            {data.suppliers.map(s => (
                              <NativeSelectOption key={s.id} value={s.id}>
                                {s.display_name}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        )}
                      </TextField>
                      <TextField label="Xarid qiymati">{id => <MoneyInput id={id} name="amount" value={cost} disabled={!enabled} onChange={setCost} />}</TextField>
                      <TextField label="Hujjat yoki izoh">{id => <Input id={id} name="reference" maxLength={120} value={reference} disabled={!enabled} onChange={e => setReference(e.target.value)} />}</TextField>
                      <TextField label="To‘lov muddati (ixtiyoriy)">{id => <Input id={id} name="dueDate" type="date" value={dueDate} disabled={!enabled} onChange={e => setDueDate(e.target.value)} />}</TextField>
                    </div>
                    <SubmitButton disabled={!enabled || !supplierId || !isAmount(cost)} className="self-start">
                      Xaridni qayd etish
                    </SubmitButton>
                  </form>
                )}
              </Section>
              <Section title="Xaridlar">
                {data.invoices.length ? (
                  <TableFrame>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Yetkazib beruvchi</TableHead>
                          <TableHead>Hujjat</TableHead>
                          <TableHead className="text-right">Qiymat</TableHead>
                          <TableHead className="text-right">To‘langan</TableHead>
                          <TableHead className="text-right">Qarz</TableHead>
                          <TableHead>Muddat</TableHead>
                          <TableHead>Holat</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.invoices.map(i => (
                          <TableRow key={i.id}>
                            <TableCell className="font-medium">{i.display_name}</TableCell>
                            <TableCell>{i.reference || i.id.slice(0, 8)}</TableCell>
                            <TableCell className="text-right">
                              <Money value={i.amount_uzs} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Money value={i.paid_uzs} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Money value={i.outstanding_uzs} />
                            </TableCell>
                            <TableCell>{formatDay(i.due_date)}</TableCell>
                            <TableCell>
                              <StatusBadge tone={statusTone[i.status as keyof typeof statusTone] ?? "neutral"}>{statuses[i.status] ?? i.status}</StatusBadge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableFrame>
                ) : (
                  <EmptyState title="Xaridlar yo‘q" />
                )}
              </Section>
            </TabsContent>

            <TabsContent value="payments" className="flex flex-col gap-5">
              <Section title="Ta’minotchiga to‘lovni qayd etish" description="Tizimdan tashqarida to‘langan summani kiriting.">
                {!payable.length ? (
                  <EmptyState title="To‘lanmagan xarid yo‘q" />
                ) : (
                  <form
                    className="flex flex-col gap-4"
                    onSubmit={e => {
                      e.preventDefault();
                      if (!enabled || !invoice || !isAmount(amount) || overPay || !date) return;
                      setConfirm({
                        body: { action: "payment", invoiceId, amount, date, method },
                        reset: () => setAmount(""),
                        title: "To‘lovni qayd etasizmi?",
                        description: "Qayd kassa hisobotiga chiqim sifatida tushadi.",
                        label: "To‘lovni qayd etish",
                        rows: [
                          ["Xarid", invoiceLabel(invoiceId)],
                          ["Summa", <Money key="a" value={amount} />],
                          ["Sana", formatDay(date)],
                          ["Usul", methods[method]],
                        ],
                      });
                    }}
                  >
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <TextField
                        label="Xarid"
                        description={
                          invoice ? (
                            <>
                              Qarz: <Money value={invoice.outstanding_uzs} />
                            </>
                          ) : undefined
                        }
                      >
                        {id => (
                          <NativeSelect id={id} name="invoiceId" className="w-full" required value={invoiceId} disabled={!enabled} onChange={e => setInvoiceId(e.target.value)}>
                            <NativeSelectOption value="">Tanlang</NativeSelectOption>
                            {payable.map(i => (
                              <NativeSelectOption key={i.id} value={i.id}>
                                {i.display_name} · {i.reference || i.id.slice(0, 8)}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        )}
                      </TextField>
                      <TextField label="To‘langan summa" error={overPay ? "Summa qarzdan oshmasligi kerak." : undefined}>
                        {id => <MoneyInput id={id} name="amount" value={amount} disabled={!enabled} aria-invalid={overPay || undefined} onChange={setAmount} />}
                      </TextField>
                      <TextField label="Sana">{id => <Input id={id} name="date" required type="date" value={date} disabled={!enabled} onChange={e => setDate(e.target.value)} />}</TextField>
                      <TextField label="Usul">
                        {id => (
                          <NativeSelect id={id} name="method" className="w-full" value={method} disabled={!enabled} onChange={e => setMethod(e.target.value)}>
                            {Object.entries(methods).map(([k, v]) => (
                              <NativeSelectOption key={k} value={k}>
                                {v}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        )}
                      </TextField>
                    </div>
                    <SubmitButton disabled={!enabled || !invoice || !isAmount(amount) || overPay || !date} className="self-start">
                      To‘lovni qayd etish
                    </SubmitButton>
                  </form>
                )}
              </Section>
              <Section title="To‘lovlar tarixi">
                {data.payments.length ? (
                  <TableFrame>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Xarid</TableHead>
                          <TableHead>Sana</TableHead>
                          <TableHead className="text-right">Summa</TableHead>
                          <TableHead>Usul</TableHead>
                          <TableHead>Holat</TableHead>
                          <TableHead className="text-right">Amal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.payments.map(p => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{invoiceLabel(p.invoice_id)}</TableCell>
                            <TableCell>{formatDay(p.paid_on)}</TableCell>
                            <TableCell className="text-right">
                              <Money value={p.amount_uzs} />
                            </TableCell>
                            <TableCell>{p.method ? (methods[p.method] ?? p.method) : "—"}</TableCell>
                            <TableCell>
                              <RecordBadge reversed={p.reversed} />
                            </TableCell>
                            <TableCell className="text-right">
                              {!p.reversed && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={!enabled}
                                  onClick={() => {
                                    setReverseId(p.id);
                                    setReason("");
                                    setError("");
                                  }}
                                >
                                  Tuzatish
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableFrame>
                ) : (
                  <EmptyState title="To‘lovlar yo‘q" />
                )}
              </Section>
            </TabsContent>
          </Tabs>

          <ConfirmDialog open={!!confirm} onOpenChange={next => !next && setConfirm(null)} title={confirm?.title ?? ""} description={confirm?.description} confirmLabel={confirm?.label ?? ""} busy={busy} onConfirm={() => confirm && void post(confirm.body, confirm.reset)}>
            {confirm && <SummaryList rows={confirm.rows} />}
          </ConfirmDialog>

          <Dialog open={!!reversing} onOpenChange={next => !next && !busy && setReverseId("")}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>To‘lov qaydini bekor qilish</DialogTitle>
                <DialogDescription>Qayd bekor qilinadi va xarid bo‘yicha qarz qayta ochiladi. Pul o‘tkazilmaydi.</DialogDescription>
              </DialogHeader>
              {reversing && (
                <SummaryList
                  rows={[
                    ["Xarid", invoiceLabel(reversing.invoice_id)],
                    ["Summa", <Money key="a" value={reversing.amount_uzs} />],
                    ["Sana", formatDay(reversing.paid_on)],
                  ]}
                />
              )}
              <TextField label="Tuzatish sababi" description="Kamida 3 belgi.">
                {id => <Textarea id={id} name="reason" rows={3} required minLength={3} maxLength={240} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} />}
              </TextField>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={busy} onClick={() => setReverseId("")}>
                  Ortga
                </Button>
                <Button type="button" variant="destructive" disabled={!enabled || reason.trim().length < 3} onClick={() => void post({ action: "reverse", paymentId: reverseId, reason }, () => setReason(""))}>
                  {busy && <Spinner data-icon="inline-start" />}
                  Qaydni bekor qilish
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  );
}
