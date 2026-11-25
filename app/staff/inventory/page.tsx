"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PencilIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState, InlineError, LoadingBlock, Notice, PageHeader, RefreshButton, Section, StatusBadge, SummaryList, TableFrame, TextField, errorText, formatStamp } from "@/components/admin/kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { staffFetch } from "@/lib/staff-client";

type Variant = { id: string; name: string; sku: string; color: string; storage_label: string | null; quantity: number; active: boolean };
type Adjustment = { id: string; name: string; sku: string; color: string; storage_label: string | null; quantity_before: number; quantity_after: number; note: string; created_at: string };
type Data = { variants: Variant[]; adjustments: Adjustment[]; truncated: boolean };
const variantLabel = (v: { color: string; storage_label: string | null }) => [v.storage_label, v.color].filter(Boolean).join(" · ");
const signed = (n: number) => (n > 0 ? "+" + n : "−" + Math.abs(n));

export default function Inventory() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Variant | null>(null);
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const pending = useRef(false);
  const key = useRef("");

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
    void load();
  }, [load]);

  const q = /^(0|[1-9][0-9]{0,5})$/.test(quantity) ? Number(quantity) : null;
  const tooMany = q !== null && q > 100000;
  const changed = q !== null && !!editing && q !== editing.quantity;
  const valid = !!editing && changed && !tooMany && note.trim().length >= 3 && !busy;

  async function save() {
    if (!valid || !editing || q === null || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      key.current ||= crypto.randomUUID();
      await staffFetch("/api/admin/inventory", "POST", { variantId: editing.id, quantity: q, expected: editing.quantity, note: note.trim(), key: key.current });
      toast.success("Qoldiq saqlandi.");
      setEditing(null);
      await load();
    } catch (e) {
      setError(errorText(e, "Saqlanmadi"));
      void load();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const filtered = data?.variants.filter(v => [v.name, v.sku, v.color, v.storage_label].join(" ").toLowerCase().includes(search.toLowerCase())) ?? [];
  return (
    <>
      <PageHeader title="Ombor" description="Mahsulotlar qoldig‘i. Sotuv tasdiqlanganda qoldiq o‘zi kamayadi.">
        <RefreshButton busy={loading || busy} onClick={() => void load()} />
      </PageHeader>
      {loading && !data ? (
        <LoadingBlock rows={6} label="Ombor yuklanmoqda" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => void load()} />
      ) : data ? (
        <>
          {data.truncated && <Notice>Ro‘yxat uzun: birinchi 500 ta variant ko‘rsatilgan. Qidiruvdan foydalaning.</Notice>}
          <Section title="Mahsulotlar qoldig‘i">
            <div className="relative sm:max-w-sm">
              <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" name="search" aria-label="Qoldiq bo‘yicha qidirish" placeholder="Mahsulot, SKU yoki rang" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {filtered.length ? (
              <TableFrame>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mahsulot</TableHead>
                      <TableHead className="hidden md:table-cell">SKU</TableHead>
                      <TableHead className="text-right">Qoldiq</TableHead>
                      <TableHead className="hidden sm:table-cell">Holat</TableHead>
                      <TableHead className="text-right">
                        <span className="sr-only">Amal</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(v => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium whitespace-normal">
                          {v.name}
                          <span className="block font-normal text-muted-foreground">{variantLabel(v)}</span>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">{v.sku}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{v.quantity}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <StatusBadge tone={!v.active ? "neutral" : v.quantity > 0 ? "success" : "warning"}>{!v.active ? "Faol emas" : v.quantity > 0 ? "Mavjud" : "Tugagan"}</StatusBadge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="secondary"
                            aria-label={`${v.name}, ${variantLabel(v)}: qoldiqni o‘zgartirish`}
                            onClick={() => {
                              setEditing(v);
                              setQuantity(String(v.quantity));
                              setNote("");
                              setError("");
                              key.current = "";
                            }}
                          >
                            <PencilIcon data-icon="inline-start" />
                            O‘zgartirish
                          </Button>
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

          <Section title="O‘zgarishlar tarixi">
            {data.adjustments.length ? (
              <TableFrame>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sana</TableHead>
                      <TableHead>Mahsulot</TableHead>
                      <TableHead className="text-right">Qoldiq</TableHead>
                      <TableHead>Sabab</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.adjustments.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="text-muted-foreground tabular-nums">{formatStamp(a.created_at)}</TableCell>
                        <TableCell className="font-medium whitespace-normal">
                          {a.name}
                          <span className="block font-normal text-muted-foreground">{variantLabel(a)}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {a.quantity_before} → <span className="font-medium">{a.quantity_after}</span>
                          <span className="block text-muted-foreground">{signed(a.quantity_after - a.quantity_before)}</span>
                        </TableCell>
                        <TableCell className="whitespace-normal">{a.note}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableFrame>
            ) : (
              <EmptyState title="Hozircha o‘zgarish yo‘q" />
            )}
          </Section>

          <Dialog open={!!editing} onOpenChange={next => !next && !busy && setEditing(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Qoldiqni o‘zgartirish</DialogTitle>
                <DialogDescription>
                  {editing?.name}
                  {editing && variantLabel(editing) ? " · " + variantLabel(editing) : ""}
                </DialogDescription>
              </DialogHeader>
              <form
                id="stock-adjustment"
                className="grid gap-4"
                onSubmit={e => {
                  e.preventDefault();
                  void save();
                }}
              >
                <TextField label="Yangi miqdor, dona" error={tooMany ? "Ko‘pi bilan 100 000 dona." : undefined}>
                  {id => (
                    <Input
                      id={id}
                      name="quantity"
                      inputMode="numeric"
                      autoComplete="off"
                      className="tabular-nums"
                      value={quantity}
                      disabled={busy}
                      onChange={e => {
                        setQuantity(e.target.value.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "").slice(0, 6));
                        key.current = "";
                      }}
                    />
                  )}
                </TextField>
                <TextField label="Sabab" description="Masalan: yangi tovar keldi, sanoqda farq chiqdi.">
                  {id => (
                    <Textarea
                      id={id}
                      name="note"
                      rows={2}
                      maxLength={240}
                      value={note}
                      disabled={busy}
                      onChange={e => {
                        setNote(e.target.value);
                        key.current = "";
                      }}
                    />
                  )}
                </TextField>
                {editing && changed && q !== null && !tooMany && (
                  <SummaryList
                    rows={[
                      ["Hozir", editing.quantity + " dona"],
                      ["Bo‘ladi", q + " dona"],
                      ["Farq", signed(q - editing.quantity) + " dona"],
                    ]}
                  />
                )}
                <InlineError message={error} />
              </form>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(null)}>
                  Ortga
                </Button>
                <Button type="submit" form="stock-adjustment" disabled={!valid}>
                  {busy && <Spinner data-icon="inline-start" />}
                  Saqlash
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </>
  );
}
