"use client";

import { ScaleIcon, SplitIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog, EmptyState, ErrorState, InlineError, LoadingBlock, Money, Notice, RefreshButton, Section, StatusBadge, TableFrame, errorText, formatDay } from "./kit";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { staffFetch } from "@/lib/staff-client";

type Data = { cost: string | null; sold: boolean; canPost: boolean; allocations: { account_id: string; name: string; amount_uzs: string; returned_uzs: string; outstanding_uzs: string }[]; receipts: { id: string; amount_uzs: string; received_on: string; posted: boolean; shares: { account_id: string; amount_uzs: string }[] | null }[];
  /** Present only when an older hand-typed split is off the proportion. */
  correction: { allowed: boolean; reason: string | null; rows: { account_id: string; name: string; amount_uzs: string; current_uzs: string; target_uzs: string }[] } | null;
};

export function OrderCapitalReturns({ endpoint, onChanged, version = 0, plain }: { plain?: boolean; version?: number; endpoint: string; onChanged: () => void }) {
  const url = endpoint + "/capital-returns";
  const [data, setData] = useState<Data | null>(null);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [fixing, setFixing] = useState(false);
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
  const full = !!data?.cost && data.allocations.reduce((n, a) => n + BigInt(a.amount_uzs), BigInt(0)) === BigInt(data.cost);
  const valid = !!receipt?.shares && !!data?.canPost && data.sold && full && !busy && !loading;
  const nameOf = (id: string) => data?.allocations.find(a => a.account_id === id)?.name ?? "Investor";

  // The shares are computed on the server. The administrator only confirms them.
  async function send(body: Record<string, unknown>, success: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await staffFetch(url, "POST", body);
      setSelected("");
      setFixing(false);
      await load();
      toast.success(success);
      onChanged();
    } catch (e) {
      setSelected("");
      setFixing(false);
      setError(errorText(e, "Saqlanmadi"));
      void load();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  if ((!loading || data) && !loadError && !data?.cost) return null;
  return (
    <Section plain={plain} title="Kapital qaytimi" description="Olingan boshlang‘ich to‘lov investorlarga mahsulotga qo‘shgan puliga mutanosib qaytadi. Ulushlarni tizim hisoblaydi. Pul o‘tkazilmaydi." action={<RefreshButton busy={loading || busy} onClick={() => void load()} />}>
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
                            variant="secondary"
                           
                            disabled={busy}
                            onClick={() => {
                              setError("");
                              setSelected(r.id);
                            }}
                          >
                            <SplitIcon data-icon="inline-start" />
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
          {!data.canPost && data.receipts.some(r => !r.posted) && <p className="text-sm text-muted-foreground">Qaytimni faqat administrator tasdiqlaydi.</p>}
          {data.correction && (
            <>
              <Notice>
                Boshlang‘ich to‘lov investorlarga ulushiga mos taqsimlanmagan, shu sabab oylik to‘lov qabul qilinmaydi. {data.correction.reason ?? (data.canPost ? "Taqsimotni tuzatsangiz, har bir investorga o‘z ulushi yoziladi." : "Administrator taqsimotni tuzatishi kerak.")}
              </Notice>
              <ShareTable head={["Investor", "Hozir yozilgan", "Ulushi bo‘yicha"]} rows={data.correction.rows.map(r => [r.account_id, r.name, r.current_uzs, r.target_uzs])} />
              {data.correction.allowed && (
                <Button type="button" className="self-start" disabled={busy} onClick={() => { setError(""); setFixing(true); }}>
                  <ScaleIcon data-icon="inline-start" />
                  Taqsimotni tuzatish
                </Button>
              )}
            </>
          )}
          <InlineError message={error} />

          <ConfirmDialog
            open={!!receipt}
            onOpenChange={next => !next && setSelected("")}
            title="Qaytimni tasdiqlaysizmi?"
            description={
              <>
                <Money value={receipt?.amount_uzs} /> investorlarga mahsulotga qo‘shgan puliga mutanosib yoziladi. Ulushlarni tizim hisoblagan, ularni o‘zgartirib bo‘lmaydi. Tasdiqlangach mablag‘ qayta moliyalashtirish uchun ochiladi.
              </>
            }
            confirmLabel="Qaytimni tasdiqlash"
            busy={busy}
            disabled={!valid}
            onConfirm={() => void send({ receiptId: selected }, "Kapital qaytimi qayd etildi.")}
          >
            <ShareTable
              head={["Investor", "Qo‘shgan puli", "Qaytim"]}
              rows={(receipt?.shares ?? []).map(x => [x.account_id, nameOf(x.account_id), data.allocations.find(a => a.account_id === x.account_id)?.amount_uzs ?? "0", x.amount_uzs])}
            />
          </ConfirmDialog>
          <ConfirmDialog
            open={fixing && !!data.correction}
            onOpenChange={setFixing}
            title="Taqsimotni tuzatasizmi?"
            description="Har bir investorga boshlang‘ich to‘lovdan o‘z ulushi yoziladi. Ortiqcha yozilgan qaytim kamayadi, kam yozilgani ko‘payadi. Eski va yangi summalar tarixda saqlanadi."
            confirmLabel="Tuzatishni tasdiqlash"
            busy={busy}
            disabled={!data.correction?.allowed}
            onConfirm={() => void send({ action: "rebalance" }, "Qaytim ulushlarga mos qayta taqsimlandi.")}
          >
            <ShareTable head={["Investor", "Hozir", "Tuzatilgach"]} rows={(data.correction?.rows ?? []).map(r => [r.account_id, r.name, r.current_uzs, r.target_uzs])} />
          </ConfirmDialog>
        </>
      ) : null}
    </Section>
  );
}

/** Read-only money table: a name and two amounts per investor. */
function ShareTable({ head, rows }: { head: [string, string, string]; rows: [string, string, string, string][] }) {
  return (
    <TableFrame>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{head[0]}</TableHead>
            <TableHead className="text-right">{head[1]}</TableHead>
            <TableHead className="text-right">{head[2]}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(([id, name, first, second]) => (
            <TableRow key={id}>
              <TableCell className="font-medium">{name}</TableCell>
              <TableCell className="text-right text-muted-foreground">
                <Money value={first} />
              </TableCell>
              <TableCell className="text-right font-medium">
                <Money value={second} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableFrame>
  );
}
