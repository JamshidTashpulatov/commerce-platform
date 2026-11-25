"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { ShareDonut, chartColors } from "@/components/admin/charts";
import { CapitalCaveat } from "@/components/admin/capital-caveat";
import { InvestorReport } from "@/components/admin/investor-report";
import { toast } from "sonner";
import { ConfirmDialog, ErrorState, InlineError, LoadingBlock, Money, PageHeader, RefreshButton, Section, Stat, StatGrid, StatusBadge, SubmitButton, TextField, errorText, formatSum } from "@/components/admin/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { staffFetch } from "@/lib/staff-client";

type Investor = { account_id: string; name: string; contributed: string; withdrawn: string; distributed: string; allocated: string; returned: string; outstanding: string; available: string; phone_masked: string | null; sign_in: "linked" | "pending" | "none"; by_phone: boolean };

export default function InvestorPage() {
  const { id } = useParams<{ id: string }>();
  const [investor, setInvestor] = useState<Investor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const [phone, setPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);

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

  async function resetSignIn() {
    if (resetting) return;
    setResetting(true);
    setResetError("");
    try {
      await staffFetch("/api/admin/investors/accounts", "POST", { action: "resetSignIn", accountId: id });
      toast.success("Kirish qayta sozlandi. Investor raqamini qaytadan tasdiqlaydi.");
      await load();
    } catch (e) {
      setResetError(errorText(e, "Kirishni qayta sozlab bo‘lmadi"));
    } finally {
      setConfirmReset(false);
      setResetting(false);
    }
  }

  const phoneDigits = phone.replace(/[^0-9]/g, "").replace(/^998(?=\d{9})/, "").slice(0, 9);
  async function savePhone() {
    if (savingPhone || phoneDigits.length !== 9) return;
    setSavingPhone(true);
    setResetError("");
    try {
      await staffFetch("/api/admin/investors/accounts", "POST", { action: "setSignInPhone", accountId: id, phone: "+998" + phoneDigits });
      setPhone("");
      toast.success("Telefon raqam saqlandi. Investor birinchi kirishda uni tasdiqlaydi.");
      await load();
    } catch (e) {
      setResetError(errorText(e, "Telefon raqamni saqlab bo‘lmadi"));
    } finally {
      setSavingPhone(false);
    }
  }

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
      <Section title="Kirish" description="Investor Telegram mini ilovasi orqali kiradi. Telefon orqali yaratilgan hisob birinchi kirishda raqamni Telegram orqali tasdiqlaydi.">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Telefon</dt>
            <dd className="font-medium tabular-nums">{investor.phone_masked ?? (investor.sign_in === "linked" ? "Telegram ID orqali yaratilgan" : "Kiritilmagan")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Holat</dt>
            <dd>
              <StatusBadge tone={investor.sign_in === "linked" ? "success" : investor.sign_in === "pending" ? "warning" : "neutral"}>{investor.sign_in === "linked" ? "Telegram ulangan" : investor.sign_in === "pending" ? "Tasdiq kutilmoqda" : "Ulanmagan"}</StatusBadge>
            </dd>
          </div>
        </dl>
        {!investor.by_phone && investor.sign_in === "none" && (
          <form
            className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-end"
            onSubmit={e => {
              e.preventDefault();
              void savePhone();
            }}
          >
            <TextField label="Telefon raqam qo‘shish" description="Bu investor hali kira olmaydi. Raqam qo‘shilgach, u mini ilovada uni Telegram orqali tasdiqlaydi." className="sm:max-w-sm">
              {fieldId => (
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs text-muted-foreground" aria-hidden="true">
                    +998
                  </span>
                  <Input id={fieldId} name="phone" type="tel" inputMode="numeric" autoComplete="off" required className="pl-12 tabular-nums" placeholder="90 123 45 67" value={[phoneDigits.slice(0, 2), phoneDigits.slice(2, 5), phoneDigits.slice(5, 7), phoneDigits.slice(7, 9)].filter(Boolean).join(" ")} disabled={savingPhone} onChange={e => setPhone(e.target.value)} />
                </div>
              )}
            </TextField>
            <SubmitButton variant="outline" busy={savingPhone} disabled={phoneDigits.length !== 9} className="sm:mb-12">
              Raqamni saqlash
            </SubmitButton>
          </form>
        )}
        <InlineError message={resetError} />
        {investor.by_phone && investor.sign_in === "linked" && (
          <Button type="button" variant="outline" className="self-start" disabled={resetting} onClick={() => setConfirmReset(true)}>
            Kirishni qayta sozlash
          </Button>
        )}
        <ConfirmDialog open={confirmReset} onOpenChange={setConfirmReset} title="Kirishni qayta sozlaysizmi?" description="Ulangan Telegram hisobi uziladi va investorning ochiq sessiyalari yopiladi. U mini ilovaga kirganda telefon raqamini qaytadan tasdiqlaydi. Kapital va hisobotlar o‘zgarmaydi." confirmLabel="Qayta sozlash" destructive busy={resetting} onConfirm={() => void resetSignIn()} />
      </Section>
      <Section title="Kapital">
        <CapitalCaveat />
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
