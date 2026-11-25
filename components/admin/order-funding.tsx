"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog, EmptyState, ErrorState, InlineError, LoadingBlock, Money, MoneyInput, Notice, RefreshButton, Section, Stat, StatGrid, SummaryList, TextField, errorText } from "./kit";
import { Button } from "@/components/ui/button";
import { staffFetch } from "@/lib/staff-client";

type Data = { principal: string | null; allocations: { account_id: string; amount_uzs: string }[]; investors: { account_id: string; name: string; available_for_order_uzs: string }[]; enabled: boolean };

export function OrderFunding({ endpoint, locked, version = 0, plain, onChanged }: { onChanged?: () => void; plain?: boolean; version?: number; endpoint: string; locked: boolean }) {
  const url = endpoint + "/funding";
  const [data, setData] = useState<Data | null>(null);
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const pending = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const d = await staffFetch<Data>(url);
      setData(d);
      setEntries(Object.fromEntries(d.allocations.map(a => [a.account_id, a.amount_uzs])));
    } catch (e) {
      setData(null);
      setLoadError(errorText(e, "Yuklab bo‘lmadi"));
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    void load();
  }, [load, version]);

  const sum = Object.values(entries).reduce((s, v) => s + BigInt(v || "0"), BigInt(0));
  const principal = BigInt(data?.principal ?? "0");
  const editable = !!data?.enabled && !!data.principal && !locked && !busy && !loading;
  const overInvestor = (id: string) => {
    const n = BigInt(entries[id] || "0");
    return n > BigInt(0) && !data?.investors.some(i => i.account_id === id && n <= BigInt(i.available_for_order_uzs));
  };
  const valid = sum <= principal && Object.keys(entries).every(id => !overInvestor(id)) && Object.values(entries).filter(v => BigInt(v || "0") > BigInt(0)).length <= 20;
  const allocations = () =>
    Object.entries(entries)
      .filter(([, v]) => BigInt(v || "0") > BigInt(0))
      .map(([accountId, v]) => ({ accountId, amount: BigInt(v).toString() }));

  async function save() {
    if (!editable || !valid || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await staffFetch(url, "PUT", { allocations: allocations() });
      setConfirm(false);
      await load();
      toast.success("Moliyalashtirish saqlandi.");
      onChanged?.();
    } catch (e) {
      setConfirm(false);
      setError(errorText(e, "Saqlash imkoni bo‘lmadi"));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <Section plain={plain} title="Investor moliyalashtirishi" description="Mahsulot tan narxi qaysi investor kapitalidan qoplanishini belgilang. Bu hisobga olish, pul o‘tkazilmaydi." action={<RefreshButton busy={loading || busy} onClick={() => void load()} />}>
      {loading && !data ? (
        <LoadingBlock label="Moliyalashtirish yuklanmoqda" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => void load()} />
      ) : data ? (
        !data.principal ? (
          <Notice>Avval yuqorida nasiya shartlarini saqlang. Moliyalashtirish tan narxi asosida hisoblanadi.</Notice>
        ) : (
          <>
            <StatGrid className="xl:grid-cols-3">
              <Stat label="To‘liq tan narxi" value={<Money value={principal} />} />
              <Stat label="Ajratilgan kapital" value={<Money value={sum} />} tone={sum > principal ? "danger" : "default"} />
              <Stat label="Moliyalashtirish qoldig‘i" value={<Money value={principal - sum} />} tone={principal - sum < BigInt(0) ? "danger" : "default"} />
            </StatGrid>
            {!data.enabled && <Notice>Moliyalashtirish moduli server sozlamalarida o‘chirilgan.</Notice>}
            {locked && <Notice>Sotilgan yoki bekor qilingan buyurtmada taqsimot tahrirlanmaydi.</Notice>}
            {data.investors.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.investors.map(i => (
                  <TextField
                    key={i.account_id}
                    label={i.name}
                    description={
                      <>
                        Mavjud: <Money value={i.available_for_order_uzs} />
                      </>
                    }
                    error={overInvestor(i.account_id) ? "Mavjud kapitaldan oshib ketdi." : undefined}
                  >
                    {id => <MoneyInput id={id} name={"allocation-" + i.account_id} disabled={!editable} value={entries[i.account_id] ?? ""} aria-invalid={overInvestor(i.account_id) || undefined} onChange={value => setEntries(old => ({ ...old, [i.account_id]: value }))} />}
                  </TextField>
                ))}
              </div>
            ) : (
              <EmptyState title="Investor hisoblari mavjud emas" description="Administrator «Investorlar» bo‘limida hisob yaratadi va kapital kiritadi." />
            )}
            {sum > principal && <InlineError message="Ajratilgan summa tan narxidan oshib ketdi." />}
            <InlineError message={error} />
            {data.investors.length > 0 && !locked && (
              <Button type="button" className="self-start" disabled={!editable || !valid} onClick={() => setConfirm(true)}>
                Taqsimotni saqlash
              </Button>
            )}
            <p className="text-sm text-muted-foreground">Oylik tushumda kapital va foyda investorlarning shu buyurtmadagi ulushi bo‘yicha avtomatik hisoblanadi. Boshlang‘ich to‘lov qaytimini administrator quyidagi bo‘limda tasdiqlaydi.</p>
            <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Taqsimotni saqlaysizmi?" description="Ajratilgan summa investorlarning bo‘sh kapitalidan band qilinadi." confirmLabel="Saqlash" busy={busy} disabled={!valid} onConfirm={() => void save()}>
              <SummaryList rows={[...data.investors.filter(i => BigInt(entries[i.account_id] || "0") > BigInt(0)).map(i => [i.name, <Money key={i.account_id} value={entries[i.account_id]} />] as [string, React.ReactNode]), ["Jami", <Money key="sum" value={sum} />]]} />
            </ConfirmDialog>
          </>
        )
      ) : null}
    </Section>
  );
}
