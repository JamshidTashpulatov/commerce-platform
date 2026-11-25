"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, XAxis, YAxis } from "recharts";
import { formatSum } from "./kit";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

export type Series = { key: string; label: string; color: string };
/** SortUI chart tokens, always assigned in this fixed order. */
export const chartColors = ["var(--chart-2)", "var(--chart-4)", "var(--chart-3)", "var(--chart-1)", "var(--chart-7)", "var(--chart-10)"];

/** Short axis label in dollars: $850, $12.5 ming, $3.4 mln. */
export function compactSum(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, "");
  if (abs >= 1e9) return `${sign}$${trim(abs / 1e9)} mlrd`;
  if (abs >= 1e6) return `${sign}$${trim(abs / 1e6)} mln`;
  if (abs >= 1e3) return `${sign}$${trim(abs / 1e3)} ming`;
  return `${sign}$${Math.round(abs)}`;
}

const moneyRow = (value: unknown, label: string, color: string) => (
  <div className="flex w-full items-center justify-between gap-4">
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className="size-2 shrink-0 rounded-xs" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
    <span className="font-medium text-foreground tabular-nums">{formatSum(String(Math.round(Number(value))))}</span>
  </div>
);

/** Grouped vertical bars over a category axis (months, days). */
export function MoneyBars({ data, xKey, series, label }: { data: Record<string, string | number>[]; xKey: string; series: Series[]; label: string }) {
  const config: ChartConfig = Object.fromEntries(series.map(s => [s.key, { label: s.label, color: s.color }]));
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full" role="img" aria-label={label}>
      <BarChart accessibilityLayer data={data} margin={{ left: 4, right: 4, top: 8 }} barGap={2}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={compactSum} />
        <ChartTooltip cursor={{ fill: "var(--fill-1)" }} content={<ChartTooltipContent formatter={(value, name) => moneyRow(value, series.find(s => s.key === name)?.label ?? String(name), series.find(s => s.key === name)?.color ?? "currentColor")} />} />
        {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
        {series.map(s => (
          <Bar key={s.key} dataKey={s.key} fill={`var(--color-${s.key})`} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

/** One horizontal bar per named amount, each labelled with its value. */
export function AmountBars({ data, label, color = chartColors[0] }: { data: { name: string; value: number; color?: string }[]; label: string; color?: string }) {
  const config: ChartConfig = { value: { label: "Summa", color } };
  return (
    <ChartContainer config={config} className="aspect-auto w-full max-w-3xl" style={{ height: data.length * 44 + 16 }} role="img" aria-label={label}>
      <BarChart accessibilityLayer data={data} layout="vertical" margin={{ left: 4, right: 88, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={230} tick={{ fontSize: 12 }} />
        <ChartTooltip cursor={{ fill: "var(--fill-1)" }} content={<ChartTooltipContent hideLabel formatter={(value, _name, item) => moneyRow(value, String(item.payload.name), item.payload.color ?? color)} />} />
        <Bar dataKey="value" radius={4} maxBarSize={22} isAnimationActive={false}>
          {data.map(d => (
            <Cell key={d.name} fill={d.color ?? color} />
          ))}
          <LabelList dataKey="value" position="right" className="fill-foreground" fontSize={12} formatter={(v: unknown) => compactSum(Number(v))} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Parts of one whole, with the total in the middle and a legend that carries the values. */
export function ShareDonut({ data, total, totalLabel, label }: { data: { key: string; name: string; value: number; color: string }[]; total: string; totalLabel: string; label: string }) {
  const config: ChartConfig = Object.fromEntries(data.map(d => [d.key, { label: d.name, color: d.color }]));
  const sum = data.reduce((n, d) => n + d.value, 0);
  return (
    <div className="flex max-w-2xl flex-col items-center gap-4 sm:flex-row sm:gap-8">
      <div className="relative shrink-0">
        <ChartContainer config={config} className="aspect-square h-48" role="img" aria-label={label}>
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel formatter={(value, _name, item) => moneyRow(value, String(item.payload.name), item.payload.color)} />} />
            <Pie data={sum > 0 ? data : [{ key: "empty", name: "Ma’lumot yo‘q", value: 1, color: "var(--muted)" }]} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="100%" paddingAngle={sum > 0 && data.filter(d => d.value > 0).length > 1 ? 2 : 0} strokeWidth={0} isAnimationActive={false}>
              {(sum > 0 ? data : [{ key: "empty", color: "var(--muted)" }]).map(d => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-muted-foreground">{totalLabel}</span>
          <span className="text-sm font-semibold tabular-nums">{total}</span>
        </div>
      </div>
      <dl className="grid w-full gap-2 text-sm">
        {data.map(d => (
          <div key={d.key} className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2.5 shrink-0 rounded-xs" style={{ background: d.color }} aria-hidden="true" />
              {d.name}
            </dt>
            <dd className="font-medium tabular-nums">
              {formatSum(String(Math.round(d.value)))}
              <span className="ml-2 text-muted-foreground">{sum > 0 ? Math.round((d.value / sum) * 100) : 0}%</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
