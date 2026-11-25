"use client";

import { useEffect, useState } from "react";
import { MoneyBars, chartColors } from "./charts";
import { EmptyState, ErrorState, LoadingBlock, Money, Notice, Stat, StatGrid, SubmitButton, TableFrame, TextField, errorText, tashkentToday, formatStamp } from "./kit";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { staffFetch } from "@/lib/staff-client";

type Month = { month: string; contributed: string; withdrawn: string; distributed: string; returned: string; received_profit: string };
type Activity = { from: string; to: string; months: Month[]; entries: { id: string; event_type: string; amount_uzs: string; created_at: string }[]; truncated: boolean };
const labels: Record<string, string> = { principal_correction: "Kapital qaytimi tuzatildi", profit_correction: "Foyda tuzatildi", principal_return: "Kapital qaytimi", received_profit: "Tushgan foyda", contribution: "Kapital kiritildi", withdrawal: "Kapitaldan yechildi", distribution: "Foyda taqsimoti qaydi" };

/** Period report of one investor for the administrator (same read endpoint the investor portal uses). */
export function InvestorReport({ accountId }: { accountId: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<Activity | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [applied, setApplied] = useState<{ from: string; to: string } | null>(null);

  useEffect(() => {
    const today = tashkentToday();
    const start = today.slice(0, 4) + "-01-01";
    setFrom(start);
    setTo(today);
    setApplied({ from: start, to: today });
  }, []);
  useEffect(() => {
    if (!applied) return;
    let active = true;
    setLoading(true);
    setError("");
    setData(null);
    const q = new URLSearchParams(applied);
    q.set("accountId", accountId);
    staffFetch<Activity>("/api/investor/activity?" + q.toString())
      .then(d => active && setData(d))
      .catch(e => active && setError(errorText(e, "Hisobot yuklanmadi")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [accountId, applied]);

  const sum = (key: keyof Omit<Month, "month">) => data?.months.reduce((s, m) => s + BigInt(m[key]), BigInt(0)) ?? BigInt(0);
  return (
    <div className="flex flex-col gap-4">
      <form
        className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={e => {
          e.preventDefault();
          if (from && to && from <= to) setApplied({ from, to });
        }}
      >
        <TextField label="Boshlanish">{id => <Input id={id} name="from" type="date" required value={from} onChange={e => setFrom(e.target.value)} />}</TextField>
        <TextField label="Tugash">{id => <Input id={id} name="to" type="date" required min={from || undefined} value={to} onChange={e => setTo(e.target.value)} />}</TextField>
        <SubmitButton variant="outline" busy={loading} disabled={!from || !to || from > to} className="col-span-2 sm:col-span-1">
          Ko‘rsatish
        </SubmitButton>
      </form>
      <p className="text-sm text-muted-foreground">Davr operatsiya tizimga qayd etilgan sana bo‘yicha, Toshkent vaqtida hisoblanadi.</p>
      {loading ? (
        <LoadingBlock rows={4} label="Hisobot yuklanmoqda" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => applied && setApplied({ ...applied })} />
      ) : data ? (
        <>
          <StatGrid className="xl:grid-cols-5">
            <Stat label="Kiritilgan kapital" value={<Money value={sum("contributed")} />} />
            <Stat label="Kapitaldan yechilgan" value={<Money value={sum("withdrawn")} />} />
            <Stat label="Qaytgan kapital" value={<Money value={sum("returned")} />} />
            <Stat label="Tushgan foyda" value={<Money value={sum("received_profit")} />} />
            <Stat label="Foyda taqsimoti qaydlari" value={<Money value={sum("distributed")} />} />
          </StatGrid>
          <h3 className="text-sm font-medium">Oylik kesim</h3>
          {data.months.length > 0 && (
            <MoneyBars
              label="Oylik kesim"
              data={data.months.map(m => ({ month: m.month, contributed: Number(m.contributed), returned: Number(m.returned), profit: Number(m.received_profit), withdrawn: Number(m.withdrawn) }))}
              xKey="month"
              series={[
                { key: "contributed", label: "Kiritilgan", color: chartColors[0] },
                { key: "returned", label: "Qaytgan kapital", color: chartColors[1] },
                { key: "profit", label: "Tushgan foyda", color: chartColors[2] },
                { key: "withdrawn", label: "Yechilgan", color: chartColors[3] },
              ]}
            />
          )}
          {data.months.length ? (
            <TableFrame>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Oy</TableHead>
                    <TableHead className="text-right">Kiritilgan</TableHead>
                    <TableHead className="text-right">Yechilgan</TableHead>
                    <TableHead className="text-right">Qaytgan kapital</TableHead>
                    <TableHead className="text-right">Tushgan foyda</TableHead>
                    <TableHead className="text-right">Foyda qaydlari</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.months.map(m => (
                    <TableRow key={m.month}>
                      <TableCell className="font-medium">{m.month}</TableCell>
                      {(["contributed", "withdrawn", "returned", "received_profit", "distributed"] as const).map(k => (
                        <TableCell key={k} className="text-right">
                          <Money value={m[k]} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableFrame>
          ) : (
            <EmptyState title="Tanlangan davrda qaydlar yo‘q" />
          )}
          <h3 className="text-sm font-medium">Operatsiyalar tarixi</h3>
          {data.entries.length ? (
            <TableFrame>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sana</TableHead>
                    <TableHead>Operatsiya</TableHead>
                    <TableHead className="text-right">Summa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.entries.map(r => (
                    <TableRow key={r.id + r.event_type}>
                      <TableCell>{formatStamp(r.created_at)}</TableCell>
                      <TableCell>{labels[r.event_type] ?? r.event_type}</TableCell>
                      <TableCell className="text-right">
                        <Money value={r.amount_uzs} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableFrame>
          ) : (
            <EmptyState title="Operatsiyalar yo‘q" />
          )}
          {data.truncated && <Notice>Oxirgi 200 ta qayd ko‘rsatilmoqda. Torroq davr tanlang. Oylik jami barcha qaydlarni qamrab oladi.</Notice>}
          <p className="text-sm text-muted-foreground">Tushgan foyda oylik to‘lovlardan tizim tomonidan hisoblanadi. Investorga berilgan foyda alohida qayd etiladi.</p>
        </>
      ) : null}
    </div>
  );
}
