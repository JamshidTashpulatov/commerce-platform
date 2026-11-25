"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog, EmptyState, ErrorState, InlineError, LoadingBlock, Money, MoneyInput, Notice, RefreshButton, Section, StatusBadge, SummaryList, TableFrame, TextField, errorText, formatDay } from "./kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { staffFetch } from "@/lib/staff-client";

type Data = { cost: string | null; sold: boolean; canPost: boolean; allocations: { account_id: string; name: string; amount_uzs: string; returned_uzs: string; outstanding_uzs: string }[]; receipts: { id: string; amount_uzs: string; received_on: string; posted: boolean }[] };

export function OrderCapitalReturns({ endpoint, onChanged, version = 0, plain }: { plain?: boolean; version?: number; endpoint: string; onChanged: () => void }) {
  const url = endpoint + "/capital-returns";
  const [data, setData] = useState<Data | null>(null);
  const [selected, setSelected] = useState("");
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const pending = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setData(await staffFetch<Data>(url));
    } catch (e) {
      setData(null);
      setLoadError(errorText(e, "Yuklanmadi"));
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    void load();
  }, [load, version]);

  const receipt = data?.receipts.find(r => r.id === selected && !r.posted);
  const sum = Object.values(entries).reduce((n, v) => n + BigInt(v || "0"), BigInt(0));
  const full = !!data?.cost && data.allocations.reduce((n, a) => n + BigInt(a.amount_uzs), BigInt(0)) === BigInt(data.cost);
  const over = (id: string) => {
    const a = data?.allocations.find(a => a.account_id === id);
    return !a || BigInt(entries[id] || "0") > BigInt(a.outstanding_uzs);
  };
  const valid = !!receipt && sum === BigInt(receipt.amount_uzs) && !!data?.canPost && data.sold && full && !busy && !loading && Object.keys(entries).every(id => !over(id));

  async function post() {
    if (!valid || !confirm || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await staffFetch(url, "POST", {
        receiptId: selected,
        entries: Object.entries(entries)
          .filter(([, v]) => BigInt(v || "0") > BigInt(0))
          .map(([accountId, v]) => ({ accountId, amount: BigInt(v).toString() })),
      });
      setSelected("");
      setEntries({});
      setConfirm(false);
      await load();
      toast.success("Kapital qaytimi qayd etildi.");
      onChanged();
    } catch (e) {
      setConfirm(false);
      setError(errorText(e, "Saqlanmadi"));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  if ((!loading || data) && !loadError && !data?.cost) return null;
  return (
    <Section plain={plain} title="Kapital qaytimi" description="Haqiqatan olingan boshlang‘ich to‘lov investorlarning asosiy kapitaliga qaytim sifatida yoziladi. Pul o‘tkazilmaydi." action={<RefreshButton busy={loading || busy} onClick={() => void load()} />}>
      {loading && !data ? (
        <LoadingBlock label="Kapital qaytimi yuklanmoqda" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => void load()} />
      ) : data ? (
        <>
          {data.allocations.length > 0 && (
            <TableFrame>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Investor</TableHead>
                    <TableHead className="text-right">Ajratilgan</TableHead>
                    <TableHead className="text-right">Qaytgan</TableHead>
                    <TableHead className="text-right">Aylanmada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.allocations.map(a => (
                    <TableRow key={a.account_id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-right">
                        <Money value={a.amount_uzs} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={a.returned_uzs} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={a.outstanding_uzs} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableFrame>
          )}
          {(!data.sold || !full) && <Notice>Qaytimni qayd etishdan avval to‘liq tan narxini investorlar kapitalidan moliyalashtiring va sotuvni tasdiqlang.</Notice>}
          <h3 className="text-sm font-medium">Boshlang‘ich to‘lovlar</h3>
          {data.receipts.length ? (
            <TableFrame>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sana</TableHead>
                    <TableHead className="text-right">Summa</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead className="text-right">Amal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.receipts.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{formatDay(r.received_on)}</TableCell>
                      <TableCell className="text-right">
                        <Money value={r.amount_uzs} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={r.posted ? "success" : "warning"}>{r.posted ? "Kapitalga qaytarilgan" : "Taqsimlanmagan"}</StatusBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        {!r.posted && data.canPost && data.sold && full && (
                          <Button
                            type="button"
                            variant="outline"
                           
                            disabled={busy}
                            onClick={() => {
                              setSelected(r.id);
                              setEntries({});
                              setError("");
                              setConfirm(false);
                            }}
                          >
                            Taqsimlash
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableFrame>
          ) : (
            <EmptyState title="Boshlang‘ich to‘lovlar mavjud emas" />
          )}
          {!data.canPost && data.receipts.some(r => !r.posted) && <p className="text-sm text-muted-foreground">Qaytimni faqat administrator taqsimlaydi.</p>}

          <Dialog open={!!receipt && !confirm} onOpenChange={next => !next && !busy && setSelected("")}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Qaytimni taqsimlash</DialogTitle>
                <DialogDescription>
                  <Money value={receipt?.amount_uzs} /> to‘liq taqsimlanishi kerak. Har bir investorga uning aylanmadagi kapitalidan ko‘p yozib bo‘lmaydi.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                {data.allocations.map(a => (
                  <TextField
                    key={a.account_id}
                    label={a.name}
                    description={
                      <>
                        Aylanmada: <Money value={a.outstanding_uzs} />
                      </>
                    }
                    error={entries[a.account_id] && over(a.account_id) ? "Aylanmadagi kapitaldan oshib ketdi." : undefined}
                  >
                    {id => <MoneyInput id={id} name={"return-" + a.account_id} value={entries[a.account_id] ?? ""} disabled={busy} onChange={value => setEntries(old => ({ ...old, [a.account_id]: value }))} />}
                  </TextField>
                ))}
                <SummaryList
                  rows={[
                    ["Jami taqsimlangan", <Money key="s" value={sum} />],
                    ["Qolgan", <Money key="r" value={BigInt(receipt?.amount_uzs ?? "0") - sum} />],
                  ]}
                />
                <InlineError message={error} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={busy} onClick={() => setSelected("")}>
                  Ortga
                </Button>
                <Button type="button" disabled={!valid} onClick={() => setConfirm(true)}>
                  Davom etish
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Qaytimni tasdiqlaysizmi?" description="Qayd tasdiqlangach mablag‘ qayta moliyalashtirish uchun ochiladi. Bu qaydni keyin tahrirlab yoki bekor qilib bo‘lmaydi." confirmLabel="Qaytimni tasdiqlash" busy={busy} disabled={!valid} onConfirm={() => void post()}>
            <SummaryList rows={data.allocations.filter(a => BigInt(entries[a.account_id] || "0") > BigInt(0)).map(a => [a.name, <Money key={a.account_id} value={entries[a.account_id]} />])} />
          </ConfirmDialog>
        </>
      ) : null}
    </Section>
  );
}
