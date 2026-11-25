"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { ShareDonut, chartColors } from "@/components/admin/charts";
import { InvestorReport } from "@/components/admin/investor-report";
import { ErrorState, LoadingBlock, Money, PageHeader, RefreshButton, Section, Stat, StatGrid, errorText, formatSum } from "@/components/admin/kit";
import { buttonVariants } from "@/components/ui/button";
import { staffFetch } from "@/lib/staff-client";

type Investor = { account_id: string; name: string; contributed: string; withdrawn: string; distributed: string; allocated: string; returned: string; outstanding: string; available: string };

export default function InvestorPage() {
  const { id } = useParams<{ id: string }>();
  const [investor, setInvestor] = useState<Investor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await staffFetch<{ items: Investor[] }>("/api/admin/investors");
      const found = d.items.find(i => i.account_id === id) ?? null;
      setInvestor(found);
      if (!found) setError("Investor topilmadi.");
    } catch (e) {
      setInvestor(null);
      setError(errorText(e, "Yuklab bo‘lmadi"));
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  const back = (
    <Link href="/staff/investors" className={buttonVariants({ variant: "ghost", className: "self-start" })}>
      <ArrowLeftIcon data-icon="inline-start" />
      Investorlar
    </Link>
  );
  if (loading && !investor)
    return (
      <>
        {back}
        <LoadingBlock rows={6} label="Investor yuklanmoqda" />
      </>
    );
  if (!investor)
    return (
      <>
        {back}
        <ErrorState message={error || "Investor topilmadi."} onRetry={() => void load()} />
      </>
    );

  const principal = BigInt(investor.contributed) - BigInt(investor.withdrawn);
  return (
    <>
      {back}
      <PageHeader title={investor.name} description="Investor portfeli va davriy hisobot. Faqat ko‘rish uchun, qaydlar «Investorlar» sahifasida kiritiladi.">
        <RefreshButton busy={loading} onClick={() => void load()} />
      </PageHeader>
      <Section title="Kapital">
        <StatGrid>
          <Stat label="Joriy asosiy kapital" value={<Money value={principal} />} />
          <Stat label="Kiritilgan" value={<Money value={investor.contributed} />} />
          <Stat label="Yechilgan" value={<Money value={investor.withdrawn} />} />
          <Stat label="Foyda taqsimoti qaydi" value={<Money value={investor.distributed} />} />
          <Stat label="Ajratilgan (yalpi)" value={<Money value={investor.allocated} />} />
          <Stat label="Qaytgan" value={<Money value={investor.returned} />} />
          <Stat label="Aylanmada" value={<Money value={investor.outstanding} />} />
          <Stat label="Bo‘sh kapital" value={<Money value={investor.available} />} />
        </StatGrid>
        <ShareDonut
          label="Kapital tuzilmasi"
          totalLabel="Asosiy kapital"
          total={formatSum(principal)}
          data={[
            { key: "outstanding", name: "Aylanmada", value: Number(investor.outstanding), color: chartColors[0] },
            { key: "available", name: "Bo‘sh kapital", value: Number(investor.available), color: chartColors[1] },
          ]}
        />
      </Section>
      <Section title="Davriy hisobot">
        <InvestorReport key={investor.account_id} accountId={investor.account_id} />
      </Section>
    </>
  );
}
