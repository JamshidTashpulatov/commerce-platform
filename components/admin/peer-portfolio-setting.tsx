"use client";

import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog, ErrorState, InlineError, LoadingBlock, Section, errorText } from "./kit";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { staffFetch } from "@/lib/staff-client";

/** Whether investors may see other investors' portfolios. The API enforces it; this only changes the setting. */
export function PeerPortfolioSetting() {
  const [saved, setSaved] = useState<boolean | null>(null);
  const [next, setNext] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(false);
  const id = useId();

  useEffect(() => {
    let active = true;
    setLoadError("");
    staffFetch<{ allowPeerPortfolios: boolean }>("/api/admin/settings/investors")
      .then(d => active && setSaved(d.allowPeerPortfolios))
      .catch(e => active && setLoadError(errorText(e, "Sozlamalar yuklanmadi")));
    return () => {
      active = false;
    };
  }, [attempt]);

  async function save() {
    if (pending.current || saved === null || next === null || saved === next) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const d = await staffFetch<{ allowPeerPortfolios: boolean }>("/api/admin/settings/investors", "PUT", { allowPeerPortfolios: next });
      setSaved(d.allowPeerPortfolios);
      toast.success("Sozlama saqlandi.");
    } catch (e) {
      setError(errorText(e, "Saqlanmadi"));
    } finally {
      setNext(null);
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <Section title="Investorlar maxfiyligi">
      {loadError ? (
        <ErrorState message={loadError} onRetry={() => setAttempt(a => a + 1)} />
      ) : saved === null ? (
        <LoadingBlock rows={1} label="Sozlama yuklanmoqda" />
      ) : (
        <>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor={id}>Boshqa investorlar portfelini ko‘rsatish</FieldLabel>
              <FieldDescription>Yoqilganda investorlar shu fonddagi boshqa investorlarning kapitali va umumiy foyda qaydlarini ko‘radi. Alohida to‘lovlar, buyurtmalar va mijoz ma’lumotlari ochilmaydi. Investorlar hech narsani tahrirlay olmaydi.</FieldDescription>
            </FieldContent>
            <Switch id={id} checked={saved} disabled={busy} onCheckedChange={value => setNext(value)} />
          </Field>
          <InlineError message={error} />
          <ConfirmDialog open={next !== null && next !== saved} onOpenChange={open => !open && setNext(null)} title={next ? "Portfellarni investorlarga ochasizmi?" : "Portfellarni yopasizmi?"} description={next ? "Barcha investorlar bir-birining kapitali va foyda qaydlarini ko‘ra boshlaydi." : "Har bir investor faqat o‘z portfelini ko‘radi."} confirmLabel={next ? "Ochish" : "Yopish"} busy={busy} onConfirm={() => void save()} />
        </>
      )}
    </Section>
  );
}
