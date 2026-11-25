"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { EmptyState, ErrorState, InlineError, LoadingBlock, Money, Notice, PageHeader, Section, SubmitButton, SummaryList, TextField, errorText } from "@/components/admin/kit";
import { OrderFunding } from "@/components/admin/order-funding";
import { OrderPayments } from "@/components/admin/order-payments";
import { useOrderProgress } from "@/components/admin/order-progress";
import { OrderSteps, type OrderStep } from "@/components/admin/order-steps";
import { buttonVariants } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { staffFetch, type StaffItem, type StaffOrder, type StaffVariant } from "@/lib/staff-client";

const isUuid = (value: string | null): value is string => !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function Back() {
  return (
    <Link href="/staff" className={buttonVariants({ variant: "ghost", className: "self-start" })}>
      <ArrowLeftIcon data-icon="inline-start" />
      Buyurtmalar
    </Link>
  );
}

/** Step 1: choose the product. Creating the order is what makes terms and investor funding possible. */
function ProductForm({ onCreated }: { onCreated: (id: string) => void }) {
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
      onCreated(d.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Buyurtmani yaratib bo‘lmadi");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock rows={3} label="Mahsulotlar yuklanmoqda" />;
  if (loadError) return <ErrorState message={loadError} onRetry={() => setAttempt(a => a + 1)} />;
  if (!variants.length) return <EmptyState title="Sotuvdagi mahsulot yo‘q" description="Avval katalogga mahsulot va faol variant qo‘shing." />;
  return (
    <form onSubmit={submit} className="max-w-xl">
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
          Buyurtma yaratish va davom etish
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}

function NewOrder() {
  const router = useRouter();
  const params = useSearchParams();
  const orderId = isUuid(params.get("order")) ? params.get("order")! : "";
  const endpoint = "/api/admin/orders/" + orderId;
  const [detail, setDetail] = useState<{ order: StaffOrder; items: StaffItem[] } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [version, setVersion] = useState(0);

  const refresh = useCallback(async () => {
    if (!orderId) return;
    setLoadError("");
    try {
      setDetail(await staffFetch<{ order: StaffOrder; items: StaffItem[] }>(endpoint));
      setVersion(v => v + 1);
    } catch (e) {
      setDetail(null);
      setLoadError(errorText(e, "Buyurtmani yuklab bo‘lmadi"));
    }
  }, [endpoint, orderId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const { progress } = useOrderProgress(endpoint, version, false, !!orderId);

  const terms = progress.payments?.terms ?? null;
  const installment = terms?.payment_type === "installment";
  const principal = progress.funding?.principal ? BigInt(progress.funding.principal) : null;
  const funded = (progress.funding?.allocations ?? []).reduce((n, a) => n + BigInt(a.amount_uzs), BigInt(0));
  const fundingDone = principal !== null && funded === principal;
  const item = detail?.items[0];
  const locked = detail ? detail.order.sale_status === "sold" || detail.order.request_status === "cancelled" : false;

  const steps: OrderStep[] = [
    {
      id: "product",
      title: "Mahsulot",
      description: "Mahsulot va miqdorni tanlang. Buyurtma yaratilgach to‘lov shartlari va investorlarni belgilash ochiladi. Bu ombor qoldig‘ini band qilmaydi.",
      status: orderId ? "done" : "current",
      summary: item ? (
        <>
          {[item.name, item.storage_label, item.color].filter(Boolean).join(" · ")} · {item.quantity} dona · <Money value={BigInt(item.unit_price_uzs) * BigInt(item.quantity)} />
        </>
      ) : (
        "Buyurtma yaratildi."
      ),
      content: orderId ? <Notice>Buyurtma yaratilgan. Mahsulotni o‘zgartirish uchun yangi buyurtma oching.</Notice> : <ProductForm onCreated={id => router.replace("/staff/new?order=" + id)} />,
    },
    {
      id: "terms",
      title: "To‘lov turi va shartlari",
      description: "To‘liq to‘lov yoki nasiyani tanlang va tan narxini kiriting. Shundan keyin investorlarni belgilash ochiladi.",
      status: !orderId ? "blocked" : terms ? "done" : "current",
      reason: "Avval mahsulotni tanlab, buyurtma yarating.",
      summary: terms ? (
        <>
          {installment ? `Nasiya, ${terms.term_months} oy` : "To‘liq to‘lov"} · jami <Money value={terms.agreed_total_uzs} />
          {terms.cost_uzs && (
            <>
              {" "}
              · tan narxi <Money value={terms.cost_uzs} />
            </>
          )}
        </>
      ) : undefined,
      content: orderId ? <OrderPayments plain part="terms" endpoint={endpoint} cancelled={detail?.order.request_status === "cancelled"} onChanged={() => void refresh()} /> : null,
    },
    {
      id: "investors",
      title: "Investorlar",
      description: "Tan narxini qaysi investorlar qoplashini administrator tanlaydi: teng taqsimlaydi yoki har biriga summani qo‘lda kiritadi. Tan narxi to‘liq taqsimlanadi.",
      status: !orderId || !terms || principal === null ? "blocked" : fundingDone ? "done" : "current",
      reason: !orderId || !terms ? "Avval to‘lov shartlarini saqlang." : "Tan narxi kiritilmagan. To‘lov shartlarida tan narxini saqlang.",
      summary: (
        <>
          Ajratilgan: <Money value={funded} /> / <Money value={principal ?? "0"} />
        </>
      ),
      content: orderId && principal !== null ? <OrderFunding plain endpoint={endpoint} locked={locked} cash={!installment} onChanged={() => void refresh()} /> : null,
    },
  ];

  return (
    <>
      <Back />
      <PageHeader title="Yangi buyurtma" description="Mahsulot, to‘lov shartlari va investorlar shu yerda belgilanadi. Mijoz, to‘lov qabul qilish va sotuv buyurtma sahifasida davom etadi." />
      {orderId && loadError ? (
        <ErrorState message={loadError} onRetry={() => void refresh()} />
      ) : orderId && !progress.ready ? (
        <LoadingBlock rows={4} label="Buyurtma yuklanmoqda" />
      ) : (
        <Section title="Buyurtmani rasmiylashtirish">
          <OrderSteps steps={steps} />
        </Section>
      )}
      {orderId && (
        <div className="flex flex-col gap-2 border-t pt-6">
          <p className="text-sm text-muted-foreground">Buyurtma saqlangan. Bu sahifani yopsangiz ham, qolgan qadamlarni buyurtma sahifasida davom ettirasiz.</p>
          <Link href={"/staff/orders/" + orderId} className={buttonVariants({ variant: fundingDone || (!!terms && principal === null) ? "default" : "outline", className: "self-start" })}>
            Buyurtma sahifasiga o‘tish
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
        </div>
      )}
    </>
  );
}

export default function StaffNew() {
  return (
    <Suspense fallback={<LoadingBlock rows={4} label="Yuklanmoqda" />}>
      <NewOrder />
    </Suspense>
  );
}
