"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, EmptyState, ErrorState, InlineError, LoadingBlock, Money, MoneyInput, Notice, PageHeader, RefreshButton, Section, StatusBadge, SubmitButton, SummaryList, TableFrame, TextField, errorText, formatDay, tashkentToday } from "@/components/admin/kit";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { staffFetch } from "@/lib/staff-client";

type Variant = { id: string; name: string; sku: string; color: string; storage_label: string | null; quantity: number; active: boolean };
type Invoice = { id: string; display_name: string; reference: string | null; amount_uzs: string; received_uzs: string; unreceived_uzs: string };
type Receipt = { id: string; invoice_id: string; name: string; sku: string; display_name: string; quantity: number; unit_cost_uzs: string; total_uzs: string; received_on: string };
type Data = { variants: Variant[]; invoices: Invoice[]; receipts: Receipt[]; enabled: boolean; truncated: boolean };

export default function Inventory() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState(false);
  const pending = useRef(false);
  const last = useRef<{ signature: string; key: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setData(await staffFetch<Data>("/api/admin/inventory"));
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

  const invoice = data?.invoices.find(i => i.id === invoiceId);
  const variant = data?.variants.find(v => v.id === variantId && v.active);
  const q = Number(quantity);
  const costOk = /^[1-9][0-9]{0,8}$/.test(unitCost);
  const qtyOk = Number.isSafeInteger(q) && q >= 1 && q <= 10000;
  const total = costOk && qtyOk ? BigInt(unitCost) * BigInt(q) : BigInt(0);
  const overInvoice = !!invoice && total > BigInt(invoice.unreceived_uzs);
  const valid = !!data?.enabled && !busy && !loading && !!invoice && !!variant && costOk && qtyOk && !!date && total <= BigInt(invoice?.unreceived_uzs ?? "0");

  async function submit() {
    if (!valid || !confirm || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const body = { invoiceId, variantId, quantity: q, unitCost, date };
      const signature = JSON.stringify(body);
      if (last.current?.signature !== signature) last.current = { signature, key: crypto.randomUUID() };
      await staffFetch("/api/admin/inventory", "POST", { ...body, key: last.current.key });
      last.current = null;
      setConfirm(false);
      setUnitCost("");
      setQuantity("1");
      await load();
      toast.success("Mahsulot omborga qabul qilindi.");
    } catch (e) {
      setConfirm(false);
      setError(errorText(e, "Kirim saqlanmadi"));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const filtered = data?.variants.filter(v => [v.name, v.sku, v.color, v.storage_label].join(" ").toLowerCase().includes(search.toLowerCase())) ?? [];
  const openInvoices = data?.invoices.filter(i => BigInt(i.unreceived_uzs) > BigInt(0)) ?? [];

  return (
    <>
      <PageHeader title="Ombor" description="Mahsulotlar qoldig‘i va ta’minotchidan kelgan tovar kirimi. Ombor kirimi pul to‘lovi hisoblanmaydi.">
        <RefreshButton busy={loading || busy} onClick={() => void load()} />
      </PageHeader>
      {loading && !data ? (
        <LoadingBlock rows={6} label="Ombor yuklanmoqda" />
      ) : !data ? (
        <ErrorState message={loadError || "Yuklanmadi"} onRetry={() => void load()} />
      ) : (
        <>
          {data.truncated && <Notice>Ro‘yxat cheklangan. Barcha qaydlar ko‘rinmayotgan bo‘lishi mumkin.</Notice>}
          <Section title="Tovar qabul qilish" description="Kirim ta’minotchidan qilingan xaridga bog‘lanadi va tan narxi shu yerda saqlanadi.">
            {!data.enabled ? (
              <Notice>Kirim kiritish server sozlamalarida o‘chirilgan.</Notice>
            ) : !openInvoices.length ? (
              <EmptyState title="Qabul qilinadigan xarid yo‘q" description="Avval «Yetkazib beruvchilar» bo‘limida tovar xaridini qayd eting." />
            ) : (
              <form
                className="flex flex-col gap-4"
                onSubmit={e => {
                  e.preventDefault();
                  if (valid) setConfirm(true);
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Xarid">
                    {id => (
                      <NativeSelect id={id} name="invoiceId" className="w-full" required value={invoiceId} disabled={busy} onChange={e => setInvoiceId(e.target.value)}>
                        <NativeSelectOption value="">Tanlang</NativeSelectOption>
                        {openInvoices.map(i => (
                          <NativeSelectOption key={i.id} value={i.id}>
                            {i.display_name} · {i.reference || i.id.slice(0, 8)}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    )}
                  </TextField>
                  <TextField label="Mahsulot varianti">
                    {id => (
                      <NativeSelect id={id} name="variantId" className="w-full" required value={variantId} disabled={busy} onChange={e => setVariantId(e.target.value)}>
                        <NativeSelectOption value="">Tanlang</NativeSelectOption>
                        {data.variants
                          .filter(v => v.active)
                          .map(v => (
                            <NativeSelectOption key={v.id} value={v.id}>
                              {v.name} · {v.sku} · {[v.color, v.storage_label].filter(Boolean).join(" ")}
                            </NativeSelectOption>
                          ))}
                      </NativeSelect>
                    )}
                  </TextField>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <TextField label="Miqdor" error={quantity && !qtyOk ? "1 dan 10 000 gacha kiriting." : undefined}>
                    {id => <Input id={id} name="quantity" required type="number" inputMode="numeric" min={1} max={10000} value={quantity} disabled={busy} onChange={e => setQuantity(e.target.value)} />}
                  </TextField>
                  <TextField label="Bir dona tan narxi">{id => <MoneyInput id={id} name="unitCost" value={unitCost} disabled={busy} onChange={setUnitCost} />}</TextField>
                  <TextField label="Qabul sanasi">{id => <Input id={id} name="date" type="date" required value={date} disabled={busy} onChange={e => setDate(e.target.value)} />}</TextField>
                </div>
                <SummaryList
                  rows={[
                    ["Jami qiymat", <Money key="t" value={total} />],
                    ["Xarid bo‘yicha qabul qilinmagan qiymat", <Money key="u" value={invoice ? invoice.unreceived_uzs : null} />],
                  ]}
                />
                {overInvoice && <InlineError message="Jami qiymat xarid bo‘yicha qolgan qiymatdan oshib ketdi." />}
                <InlineError message={error} />
                <SubmitButton disabled={!valid} className="self-start">
                  Kirimni tekshirish
                </SubmitButton>
              </form>
            )}
          </Section>

          <Section title="Mahsulotlar qoldig‘i">
            <div className="relative w-full sm:max-w-xs">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input type="search" name="search" aria-label="Qoldiq bo‘yicha qidirish" placeholder="Mahsulot, SKU yoki rang" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {filtered.length ? (
              <TableFrame>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mahsulot</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Variant</TableHead>
                      <TableHead className="text-right">Qoldiq</TableHead>
                      <TableHead>Holat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(v => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.name}</TableCell>
                        <TableCell className="font-mono">{v.sku}</TableCell>
                        <TableCell>{[v.color, v.storage_label].filter(Boolean).join(" · ")}</TableCell>
                        <TableCell className="text-right tabular-nums">{v.quantity}</TableCell>
                        <TableCell>
                          <StatusBadge tone={v.active ? "success" : "neutral"}>{v.active ? "Faol" : "Faol emas"}</StatusBadge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableFrame>
            ) : (
              <EmptyState title={search ? "Hech narsa topilmadi" : "Omborda mahsulot yo‘q"} />
            )}
          </Section>

          <Section title="Xaridlar bo‘yicha kirim qiymati">
            {data.invoices.length ? (
              <TableFrame>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Xarid</TableHead>
                      <TableHead className="text-right">Qiymat</TableHead>
                      <TableHead className="text-right">Qabul qilingan</TableHead>
                      <TableHead className="text-right">Qolgan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.invoices.map(i => (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">
                          {i.display_name} · {i.reference || i.id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Money value={i.amount_uzs} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Money value={i.received_uzs} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Money value={i.unreceived_uzs} />
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

          <Section title="Kirimlar tarixi" description="Tan narxi kirimda saqlanadi. Kirimni tahrirlash va mahsulot qaytarish hali mavjud emas.">
            {data.receipts.length ? (
              <TableFrame>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sana</TableHead>
                      <TableHead>Ta’minotchi</TableHead>
                      <TableHead>Mahsulot</TableHead>
                      <TableHead className="text-right">Miqdor</TableHead>
                      <TableHead className="text-right">Tan narxi</TableHead>
                      <TableHead className="text-right">Jami</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.receipts.map(r => (
                      <TableRow key={r.id}>
                        <TableCell>{formatDay(r.received_on)}</TableCell>
                        <TableCell>{r.display_name}</TableCell>
                        <TableCell>
                          {r.name} · <span className="font-mono">{r.sku}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.quantity}</TableCell>
                        <TableCell className="text-right">
                          <Money value={r.unit_cost_uzs} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Money value={r.total_uzs} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableFrame>
            ) : (
              <EmptyState title="Hozircha kirim yo‘q" />
            )}
          </Section>

          <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Kirimni tasdiqlaysizmi?" description={`Ombor qoldig‘i ${q} donaga oshadi. Kirimni keyin tahrirlab yoki bekor qilib bo‘lmaydi.`} confirmLabel="Kirimni tasdiqlash" busy={busy} disabled={!valid} onConfirm={() => void submit()}>
            <SummaryList
              rows={[
                ["Mahsulot", variant ? `${variant.name} · ${variant.sku}` : "—"],
                ["Miqdor", q + " dona"],
                ["Tan narxi", <Money key="c" value={unitCost || "0"} />],
                ["Jami", <Money key="t" value={total} />],
                ["Sana", formatDay(date)],
              ]}
            />
          </ConfirmDialog>
        </>
      )}
    </>
  );
}
