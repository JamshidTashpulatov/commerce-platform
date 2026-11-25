"use client";

import { useEffect, useState } from "react";
import { AmountBars, MoneyBars, chartColors } from "@/components/admin/charts";
import { CashbookReconciliation } from "@/components/admin/cashbook-reconciliation";
import { EmptyState, ErrorState, LoadingBlock, Money, Notice, PageHeader, Section, Stat, StatGrid, SubmitButton, TableFrame, TextField, errorText, formatDay, tashkentToday } from "@/components/admin/kit";
import { ReviewList, type ReceiptReview } from "@/components/admin/reviews";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { staffFetch } from "@/lib/staff-client";

type Data = { reviews: ReceiptReview[]; from: string; to: string; opening_uzs: string; incoming_uzs: string; outgoing_uzs: string; closing_uzs: string; groups: { kind: string; count: number; amount_uzs: string }[]; entries: { source_id: string; kind: string; amount_uzs: string; movement_date: string }[]; truncated: boolean; complete: boolean };
const labels: Record<string, string> = { capital_contribution: "Investor kapitali kiritildi", capital_withdrawal: "Kapitaldan yechildi", profit_distribution: "Foyda taqsimoti qaydi", initial_receipt: "Boshlang‘ich to‘lov", cash_sale_receipt: "To‘liq to‘lov", manual_receipt_reversal: "To‘lov qaydi bekor qilindi", monthly_receipt: "Oylik to‘lov", monthly_receipt_reversal: "Oylik to‘lov qaydi bekor qilindi" };

export default function Cashbook() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [period, setPeriod] = useState<{ from: string; to: string } | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const today = tashkentToday();
    const first = today.slice(0, 7) + "-01";
    setFrom(first);
    setTo(today);
    setPeriod({ from: first, to: today });
  }, []);
  useEffect(() => {
    if (!period) return;
    let active = true;
    setLoading(true);
    setData(null);
    setError("");
    staffFetch<Data>("/api/admin/cashbook?" + new URLSearchParams(period).toString())
      .then(d => active && setData(d))
      .catch(e => active && setError(errorText(e, "Hisobot yuklanmadi")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [period]);

  const daily = (() => {
    const days = new Map<string, { day: string; incoming: number; outgoing: number }>();
    for (const e of [...(data?.entries ?? [])].reverse()) {
      const row = days.get(e.movement_date) ?? { day: formatDay(e.movement_date).slice(0, 5), incoming: 0, outgoing: 0 };
      const n = Number(e.amount_uzs);
      if (n >= 0) row.incoming += n;
      else row.outgoing -= n;
      days.set(e.movement_date, row);
    }
    return [...days.values()];
  })();
  const reload = () => period && setPeriod({ ...period });
  const openReviews = data?.reviews.filter(r => !r.resolved_at).length ?? 0;
  return (
    <>
      <PageHeader title="Kassa" description="Qayd etilgan kirim va chiqimlar hisoboti. Bu yakuniy naqd yoki bank qoldig‘i emas." />
      <form
        className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap"
        onSubmit={e => {
          e.preventDefault();
          if (from && to && from <= to) setPeriod({ from, to });
        }}
      >
        <TextField label="Boshlanish sanasi" className="sm:w-44">
          {id => <Input id={id} name="from" type="date" required value={from} onChange={e => setFrom(e.target.value)} />}
        </TextField>
        <TextField label="Tugash sanasi" className="sm:w-44">
          {id => <Input id={id} name="to" type="date" required min={from || undefined} value={to} onChange={e => setTo(e.target.value)} />}
        </TextField>
        <SubmitButton variant="outline" busy={loading} disabled={!from || !to || from > to} className="col-span-2">
          Hisobotni ko‘rish
        </SubmitButton>
      </form>

      {loading ? (
        <LoadingBlock rows={6} label="Kassa hisoboti yuklanmoqda" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data ? (
        <>
          <Section title={`${formatDay(data.from)} — ${formatDay(data.to)}`} description="Kapitalni buyurtmaga ajratish va qaytimni investorga yozish ichki harakat bo‘lib, kassa kirimida takrorlanmaydi.">
            <StatGrid>
              <Stat label="Davr boshidagi qoldiq" value={<Money value={data.opening_uzs} />} />
              <Stat label="Kirim" value={<Money value={data.incoming_uzs} />} />
              <Stat label="Chiqim va tuzatishlar" value={<Money value={data.outgoing_uzs} />} />
              <Stat label="Davr oxiridagi qoldiq" value={<Money value={data.closing_uzs} />} />
            </StatGrid>
            {daily.length > 0 && (
              <>
                <h3 className="text-sm font-medium">Kunlik kirim va chiqim</h3>
                <MoneyBars
                  label="Kunlik kirim va chiqim"
                  data={daily}
                  xKey="day"
                  series={[
                    { key: "incoming", label: "Kirim", color: chartColors[1] },
                    { key: "outgoing", label: "Chiqim va tuzatishlar", color: chartColors[2] },
                  ]}
                />
                {data.truncated && <p className="text-sm text-muted-foreground">Diagramma oxirgi 200 ta qayd asosida chizilgan. Yuqoridagi jami summalar to‘liq.</p>}
              </>
            )}
          </Section>

          <Section title={openReviews ? `To‘lov tafovutlari (${openReviews} ta ochiq)` : "To‘lov tafovutlari"} description="Bekor qilib bo‘lmaydigan xato to‘lov qaydlari. Har birini haqiqiy qaytim yoki tuzatish hujjati bilan yoping.">
            {data.reviews.length ? <ReviewList reviews={data.reviews} showOrder onResolved={reload} /> : <EmptyState title="Tafovut yo‘q" description="Ochiq yoki shu davrda yopilgan tafovut topilmadi." />}
          </Section>

          <CashbookReconciliation key={data.from + data.to} opening={data.opening_uzs} groups={data.groups} />

          <Section title="Operatsiya turi bo‘yicha">
            {data.groups.length > 0 && <AmountBars label="Operatsiya turi bo‘yicha summa" data={data.groups.map(g => ({ name: labels[g.kind] ?? g.kind, value: Math.abs(Number(g.amount_uzs)), color: g.amount_uzs.startsWith("-") ? chartColors[2] : chartColors[1] }))} />}
            {data.groups.length ? (
              <TableFrame>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Turi</TableHead>
                      <TableHead className="text-right">Soni</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.groups.map(g => (
                      <TableRow key={g.kind}>
                        <TableCell className="font-medium">{labels[g.kind] ?? g.kind}</TableCell>
                        <TableCell className="text-right tabular-nums">{g.count}</TableCell>
                        <TableCell className="text-right">
                          <Money value={g.amount_uzs} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableFrame>
            ) : (
              <EmptyState title="Ushbu davrda qaydlar yo‘q" />
            )}
          </Section>

          <Section title="Kirim-chiqim tarixi" description="Tuzatishlar haqiqiy pul qaytarilishi degani emas. Xarid xarajatlari va tarixiy qoldiq hali to‘liq ulanmagan.">
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
                      <TableRow key={r.kind + ":" + r.source_id}>
                        <TableCell>{formatDay(r.movement_date)}</TableCell>
                        <TableCell>{labels[r.kind] ?? r.kind}</TableCell>
                        <TableCell className="text-right">
                          <Money value={r.amount_uzs} className={r.amount_uzs.startsWith("-") ? "text-destructive" : undefined} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableFrame>
            ) : (
              <EmptyState title="Ushbu davrda qaydlar yo‘q" />
            )}
            {data.truncated && <Notice>Oxirgi 200 ta qayd ko‘rsatilmoqda. Jami summalar barcha qaydlarni o‘z ichiga oladi.</Notice>}
          </Section>
        </>
      ) : null}
    </>
  );
}
