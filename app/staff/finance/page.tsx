"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ErrorState, LoadingBlock, Money, PageHeader, RefreshButton, Section, Stat, StatGrid, errorText } from "@/components/admin/kit";
import { buttonVariants } from "@/components/ui/button";
import { staffFetch } from "@/lib/staff-client";

type Summary = { installment_schedule_balance_uzs: string; overdue_schedule_balance_uzs: string; supplier_invoice_balance_uzs: string; scheduled_receipts_uzs: string; manual_receipts_uzs: string; net_contributed_capital_uzs: string; allocated_principal_uzs: string; returned_principal_uzs: string; outstanding_principal_uzs: string; available_principal_uzs: string; recorded_distributions_uzs: string; recorded_fund_net_uzs: string };

export default function Finance() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await staffFetch<Summary>("/api/admin/finance"));
    } catch (e) {
      setData(null);
      setError(errorText(e, "Yuklanmadi"));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const linkClass = buttonVariants({ variant: "outline", className: "self-start" });
  return (
    <>
      <PageHeader title="Fond hisoboti" description="Tizimda qayd etilgan pul harakati, investorlar kapitali va qarzdorlik.">
        <RefreshButton busy={loading} onClick={() => void load()} />
      </PageHeader>
      {loading && !data ? (
        <LoadingBlock rows={6} label="Hisobot yuklanmoqda" />
      ) : !data ? (
        <ErrorState message={error || "Yuklanmadi"} onRetry={() => void load()} />
      ) : (
        <>
          <Section title="Qayd etilgan pul harakati" description="Bu bank yoki naqd kassa qoldig‘i emas. Faqat mavjud qaydlar asosida hisoblangan.">
            <StatGrid>
              <Stat label="Sof qayd etilgan harakat" value={<Money value={data.recorded_fund_net_uzs} />} />
              <Stat label="Boshlang‘ich va to‘liq to‘lovlar" value={<Money value={data.manual_receipts_uzs} />} />
              <Stat label="Oylik tushum" value={<Money value={data.scheduled_receipts_uzs} />} />
              <Stat label="Foyda taqsimoti qaydlari" value={<Money value={data.recorded_distributions_uzs} />} />
            </StatGrid>
            <Link className={linkClass} href="/staff/cashbook">
              Kassa hisoboti
            </Link>
          </Section>
          <Section title="Investorlar kapitali">
            <StatGrid className="xl:grid-cols-3">
              <Stat label="Sof kiritilgan asosiy kapital" value={<Money value={data.net_contributed_capital_uzs} />} />
              <Stat label="Ajratilgan (yalpi)" value={<Money value={data.allocated_principal_uzs} />} />
              <Stat label="Qaytgan asosiy kapital" value={<Money value={data.returned_principal_uzs} />} />
              <Stat label="Aylanmadagi kapital" value={<Money value={data.outstanding_principal_uzs} />} />
              <Stat label="Bo‘sh kapital" value={<Money value={data.available_principal_uzs} />} />
            </StatGrid>
            <Link className={linkClass} href="/staff/investors">
              Investorlar hisoboti
            </Link>
          </Section>
          <Section title="Qarzdorlik" description="Faollashtirilmagan shartnomalar va tarixiy Excel ma’lumotlari bu hisobotga kiritilmagan.">
            <StatGrid className="xl:grid-cols-3">
              <Stat label="Faol nasiya jadvallari qoldig‘i" value={<Money value={data.installment_schedule_balance_uzs} />} />
              <Stat label="Muddati o‘tgan to‘lovlar" value={<Money value={data.overdue_schedule_balance_uzs} />} tone={data.overdue_schedule_balance_uzs !== "0" ? "danger" : "default"} />
              <Stat label="Yetkazib beruvchilarga qarz" value={<Money value={data.supplier_invoice_balance_uzs} />} />
            </StatGrid>
          </Section>
        </>
      )}
    </>
  );
}
