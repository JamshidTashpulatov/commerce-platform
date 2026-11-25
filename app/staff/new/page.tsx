"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { EmptyState, ErrorState, InlineError, LoadingBlock, Money, PageHeader, Section, SubmitButton, SummaryList, TextField } from "@/components/admin/kit";
import { buttonVariants } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { staffFetch, type StaffVariant } from "@/lib/staff-client";

export default function StaffNew() {
  const router = useRouter();
  const [variants, setVariants] = useState<StaffVariant[]>([]);
  const [id, setId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const key = useRef("");
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    staffFetch<{ items: StaffVariant[] }>("/api/admin/variants")
      .then(d => active && setVariants(d.items))
      .catch(e => active && setLoadError(e instanceof Error ? e.message : "Mahsulotlarni yuklab bo‘lmadi"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [attempt]);

  const selected = variants.find(v => v.id === id);
  const max = Math.min(100, selected?.quantity ?? 1);
  const quantityOk = Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= max;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending.current || !selected || !quantityOk) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      key.current ||= crypto.randomUUID();
      const d = await staffFetch<{ id: string }>("/api/admin/orders", "POST", { variantId: id, quantity, requestKey: key.current });
      router.push("/staff/orders/" + d.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Buyurtmani yaratib bo‘lmadi");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <Link href="/staff" className={buttonVariants({ variant: "ghost", className: "self-start" })}>
        <ArrowLeftIcon data-icon="inline-start" />
        Buyurtmalar
      </Link>
      <PageHeader title="Yangi buyurtma" description="Buyurtma so‘rovi ombor qoldig‘ini band qilmaydi va sotuv hisoblanmaydi." />
      <Section title="Mahsulot" className="max-w-xl">
        {loading ? (
          <LoadingBlock rows={3} label="Mahsulotlar yuklanmoqda" />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={() => setAttempt(a => a + 1)} />
        ) : !variants.length ? (
          <EmptyState title="Sotuvdagi mahsulot yo‘q" description="Avval katalogga mahsulot va faol variant qo‘shing." />
        ) : (
          <form onSubmit={submit}>
            <FieldGroup>
              <TextField label="Mahsulot va konfiguratsiya">
                {fieldId => (
                  <NativeSelect
                    id={fieldId}
                    name="variantId"
                    className="w-full"
                    required
                    value={id}
                    disabled={busy}
                    onChange={e => {
                      setId(e.target.value);
                      setQuantity(1);
                      key.current = "";
                    }}
                  >
                    <NativeSelectOption value="">Mahsulot tanlang</NativeSelectOption>
                    {variants.map(v => (
                      <NativeSelectOption key={v.id} value={v.id} disabled={!v.quantity}>
                        {v.name} · {v.storage_label ?? "—"} · {v.color} · {v.quantity} dona
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </TextField>
              <TextField label="Miqdor" description={selected ? `Omborda ${selected.quantity} dona bor.` : undefined} error={selected && !quantityOk ? `1 dan ${max} gacha kiriting.` : undefined}>
                {fieldId => (
                  <Input
                    id={fieldId}
                    name="quantity"
                    type="number"
                    inputMode="numeric"
                    required
                    min={1}
                    max={max}
                    disabled={busy || !selected}
                    value={quantity}
                    onChange={e => {
                      setQuantity(Number(e.target.value));
                      key.current = "";
                    }}
                  />
                )}
              </TextField>
              {selected && quantityOk && (
                <SummaryList
                  rows={[
                    ["Birlik narxi", <Money key="p" value={selected.price_uzs} />],
                    ["So‘rov qiymati", <Money key="t" value={BigInt(selected.price_uzs) * BigInt(quantity)} />],
                  ]}
                />
              )}
              <InlineError message={error} />
              <SubmitButton busy={busy} disabled={!selected || !quantityOk} className="self-start">
                Buyurtma yaratish
              </SubmitButton>
            </FieldGroup>
          </form>
        )}
      </Section>
    </>
  );
}
