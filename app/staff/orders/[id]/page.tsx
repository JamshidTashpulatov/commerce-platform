"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, ErrorState, InlineError, LoadingBlock, Money, Notice, PageHeader, RefreshButton, Section, TableFrame, TextField, errorText, formatStamp, isAdminRole, useStaffRole } from "@/components/admin/kit";
import { OrderCapitalReturns } from "@/components/admin/order-capital-returns";
import { OrderCustomer } from "@/components/admin/order-customer";
import { OrderFunding } from "@/components/admin/order-funding";
import { OrderInstallments } from "@/components/admin/order-installments";
import { OrderPayments } from "@/components/admin/order-payments";
import { useOrderProgress } from "@/components/admin/order-progress";
import { OrderReviews } from "@/components/admin/order-reviews";
import { OrderSteps, type OrderStep, type StepStatus } from "@/components/admin/order-steps";
import { OrderWebsite } from "@/components/admin/order-website";
import { DeliveryBadge, RequestBadge, SaleBadge } from "@/components/admin/status";
import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deliveryLabels, sourceLabels, staffFetch, type StaffItem, type StaffOrder } from "@/lib/staff-client";

type Detail = { order: StaffOrder; items: StaffItem[] };

function BackLink() {
  return (
    <Link href="/staff" className={buttonVariants({ variant: "ghost", className: "self-start" })}>
      <ArrowLeftIcon data-icon="inline-start" />
      Buyurtmalar
    </Link>
  );
}

export default function StaffOrderDetails() {
  const { id } = useParams<{ id: string }>();
  const role = useStaffRole();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [delivery, setDelivery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmSale, setConfirmSale] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const pending = useRef(false);
  const endpoint = "/api/admin/orders/" + encodeURIComponent(id);

  const refresh = useCallback(async () => {
    setLoadError("");
    try {
      const data = await staffFetch<Detail>(endpoint);
      setDetail(data);
      setDelivery(data.order.fulfillment_status);
      setVersion(v => v + 1);
    } catch (e) {
      setDetail(null);
      setLoadError(errorText(e, "Buyurtmani yuklab bo‘lmadi"));
    } finally {
      setLoading(false);
    }
  }, [endpoint]);
  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const { progress } = useOrderProgress(endpoint, version, detail?.order.source === "website");

  async function mutate(method: string, path: string, body: Record<string, unknown>, success: string) {
    if (pending.current || !detail) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await staffFetch(path, method, { ...body, revision: detail.order.revision });
      toast.success(success);
      await refresh();
    } catch (e) {
      setError(errorText(e, "Saqlash imkoni bo‘lmadi"));
    } finally {
      setConfirmSale(false);
      setConfirmCancel(false);
      pending.current = false;
      setBusy(false);
    }
  }

  if (loading)
    return (
      <>
        <BackLink />
        <LoadingBlock rows={6} label="Buyurtma yuklanmoqda" />
      </>
    );
  if (!detail)
    return (
      <>
        <BackLink />
        <ErrorState title="Buyurtma ochilmadi" message={loadError || "Buyurtma topilmadi"} onRetry={() => void refresh()} />
      </>
    );

  const o = detail.order;
  const cancelled = o.request_status === "cancelled";
  const sold = o.sale_status === "sold";
  const delivered = o.fulfillment_status === "delivered";
  const total = detail.items.reduce((sum, item) => sum + BigInt(item.unit_price_uzs) * BigInt(item.quantity), BigInt(0));
  const refreshQuiet = () => void refresh();
  const setStatus = (status: string, message: string) => void mutate("PATCH", endpoint, { status }, message);

  // Where the order stands, read from the same data the sections show.
  const p = progress;
  const terms = p.payments?.terms ?? null;
  const installment = terms?.payment_type === "installment";
  const linked = p.customer?.linked ?? null;
  const receivedTarget = terms ? BigInt(installment ? terms.initial_due_uzs : terms.agreed_total_uzs) : BigInt(0);
  const manualReceived = BigInt(p.payments?.manual_received_uzs ?? "0");
  const paymentDone = !!terms && manualReceived >= receivedTarget && receivedTarget > BigInt(0);
  const principal = p.funding?.principal ? BigInt(p.funding.principal) : null;
  const funded = (p.funding?.allocations ?? []).reduce((n, a) => n + BigInt(a.amount_uzs), BigInt(0));
  const fundingDone = principal !== null && funded === principal;
  const contract = p.installments?.contract ?? null;
  const unposted = (p.returns?.receipts ?? []).filter(r => !r.posted).length;
  const website = p.website?.checkout ?? null;

  type Draft = Omit<OrderStep, "status"> & { done: boolean; blocked?: string };
  const drafts: Draft[] = [];

  drafts.push({
    id: "accept",
    title: "So‘rovni qabul qilish",
    description: "Mijoz bilan bog‘lanib, so‘rovni qabul qiling yoki bekor qiling. Qabul qilingan buyurtma «Jarayonda» holatiga o‘tadi.",
    done: o.request_status === "in_progress" || sold,
    summary: sold ? "Buyurtma qabul qilingan va sotilgan." : "Buyurtma qabul qilingan, jarayonda.",
    content: sold ? (
      <Notice>Sotilgan buyurtma holati o‘zgarmaydi.</Notice>
    ) : (
      <div className="flex flex-wrap gap-2">
        {o.request_status !== "in_progress" && (
          <Button type="button" disabled={busy} onClick={() => setStatus("in_progress", cancelled ? "Buyurtma qayta ochildi." : "Buyurtma qabul qilindi.")}>
            {cancelled ? "Qayta ochib, qabul qilish" : "Qabul qilish"}
          </Button>
        )}
        {o.request_status === "in_progress" && (
          <Button type="button" variant="outline" disabled={busy} onClick={() => setStatus("new", "Buyurtma «Yangi» holatiga qaytarildi.")}>
            «Yangi» holatiga qaytarish
          </Button>
        )}
        {!cancelled && (
          <Button type="button" variant="destructive" disabled={busy} onClick={() => setConfirmCancel(true)}>
            Bekor qilish
          </Button>
        )}
      </div>
    ),
  });

  if (p.customer)
    drafts.push({
      id: "customer",
      title: "Mijoz",
      description: "Buyurtmaga mijoz yozuvini biriktiring. Nasiya jadvali uchun pasport ma’lumotli mijoz kerak bo‘ladi.",
      done: !!linked,
      blocked: cancelled && !linked ? "Buyurtma bekor qilingan." : undefined,
      summary: linked ? `${linked.name}, ${linked.phone_masked}${linked.has_passport ? ", pasport kiritilgan" : ", pasport kiritilmagan"}` : undefined,
      content: <OrderCustomer plain endpoint={endpoint} cancelled={cancelled} onLinked={refreshQuiet} websiteContact={website && !linked ? { name: website.name, phone: website.phone, existing: !!p.website?.existing_customer } : null} />,
    });

  drafts.push({
    id: "terms",
    title: "To‘lov turi va shartlari",
    description: "To‘liq to‘lov yoki nasiyani tanlang. Nasiyada tizim ustama va jami qiymatni o‘zi hisoblaydi. Shartlar saqlangach to‘lovni qayd etish ochiladi.",
    done: !!terms,
    blocked: cancelled && !terms ? "Buyurtma bekor qilingan." : undefined,
    summary: terms ? (
      <>
        {installment ? `Nasiya, ${terms.term_months} oy` : "To‘liq to‘lov"} · jami <Money value={terms.agreed_total_uzs} />
        {installment && (
          <>
            {" "}
            · boshlang‘ich <Money value={terms.initial_due_uzs} />
          </>
        )}
      </>
    ) : undefined,
    content: <OrderPayments plain part="terms" endpoint={endpoint} cancelled={cancelled} onChanged={refreshQuiet} />,
  });

  drafts.push({
    id: "payment",
    title: installment ? "Boshlang‘ich to‘lov" : "To‘lovni qabul qilish",
    description: installment ? "Olingan boshlang‘ich to‘lovni qayd eting. U to‘liq olingach nasiya jadvalini yaratish mumkin bo‘ladi." : "Mijozdan olingan to‘lovni qayd eting. Bu faqat qayd, pul o‘tkazilmaydi.",
    done: paymentDone,
    blocked: !terms ? "Avval to‘lov shartlarini saqlang." : cancelled && !paymentDone ? "Buyurtma bekor qilingan." : undefined,
    summary: (
      <>
        Qayd etilgan: <Money value={manualReceived} /> / <Money value={receivedTarget} />
      </>
    ),
    content: <OrderPayments plain part="receipts" endpoint={endpoint} cancelled={cancelled} onChanged={refreshQuiet} />,
  });

  if (installment)
    drafts.push({
      id: "funding",
      title: "Investor moliyalashtirishi",
      description: "Tan narxi qaysi investor kapitalidan qoplanishini belgilang. Sotuv tasdiqlangach taqsimotni o‘zgartirib bo‘lmaydi.",
      done: fundingDone,
      blocked: principal === null ? "Avval nasiya shartlarini saqlang." : !fundingDone && sold ? "Sotilgan buyurtmada taqsimotni o‘zgartirib bo‘lmaydi." : !fundingDone && cancelled ? "Buyurtma bekor qilingan." : undefined,
      summary: (
        <>
          Ajratilgan: <Money value={funded} /> / <Money value={principal ?? "0"} />
        </>
      ),
      content: <OrderFunding plain endpoint={endpoint} locked={sold || cancelled} onChanged={refreshQuiet} />,
    });

  drafts.push({
    id: "sale",
    title: "Sotuvni tasdiqlash",
    description: "Mahsulot ombordan chiqariladi va buyurtma sotilgan deb belgilanadi. Shundan keyin yetkazib berish ochiladi.",
    done: sold,
    blocked: cancelled && !sold ? "Buyurtma bekor qilingan." : undefined,
    summary: "Sotuv tasdiqlangan, mahsulot ombordan chiqarilgan.",
    content: sold ? (
      <Notice>Sotuv tasdiqlangan. Qaytarish jarayoni hali mavjud emas.</Notice>
    ) : (
      <>
        {installment && !fundingDone && <Notice>Moliyalashtirish to‘liq emas. Sotuv tasdiqlangach uni o‘zgartirib bo‘lmaydi va kapital qaytimini yozib bo‘lmaydi.</Notice>}
        {terms && !paymentDone && <Notice>{installment ? "Boshlang‘ich to‘lov" : "To‘lov"} hali to‘liq qayd etilmagan. Sotuvni tasdiqlash to‘lovni qayd etmaydi.</Notice>}
        <Button type="button" className="self-start" disabled={busy} onClick={() => setConfirmSale(true)}>
          Sotuvni tasdiqlash
        </Button>
      </>
    ),
  });

  drafts.push({
    id: "delivery",
    title: "Yetkazib berish",
    description: "Yetkazish holatini belgilang. Yetkazib berish bepul.",
    done: delivered,
    blocked: !sold ? "Avval sotuvni tasdiqlang." : undefined,
    summary: "Mijozga yetkazilgan.",
    content: delivered ? (
      <Notice>Yetkazilgan buyurtma holati o‘zgarmaydi.</Notice>
    ) : (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <TextField label="Yetkazish holati" className="sm:max-w-xs">
          {fieldId => (
            <NativeSelect id={fieldId} name="fulfillment" className="w-full" value={delivery} disabled={busy} onChange={e => setDelivery(e.target.value)}>
              {Object.entries(deliveryLabels).map(([k, v]) => (
                <NativeSelectOption key={k} value={k}>
                  {v}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </TextField>
        <Button type="button" variant="outline" disabled={busy || delivery === o.fulfillment_status} onClick={() => void mutate("PUT", endpoint, { fulfillment: delivery }, "Yetkazib berish holati saqlandi.")}>
          Holatni saqlash
        </Button>
      </div>
    ),
  });

  // Recording a capital return is an administrator action; sellers do not see the step.
  if (installment && p.returns?.cost && p.returns.canPost)
    drafts.push({
      id: "returns",
      title: "Kapital qaytimi",
      description: "Olingan boshlang‘ich to‘lovni investorlar kapitaliga qaytim sifatida yozing. Mablag‘ qayta moliyalashtirish uchun ochiladi.",
      done: (p.returns.receipts.length > 0 && unposted === 0),
      blocked: !sold ? "Avval sotuvni tasdiqlang." : !fundingDone ? "Tan narxi investorlar kapitalidan to‘liq moliyalashtirilmagan." : !p.returns.receipts.length ? "Boshlang‘ich to‘lov hali qayd etilmagan." : undefined,
      summary: "Boshlang‘ich to‘lov investorlar kapitaliga qaytarilgan.",
      content: <OrderCapitalReturns plain endpoint={endpoint} onChanged={refreshQuiet} version={version} />,
    });

  if (installment) {
    drafts.push({
      id: "schedule",
      title: "Nasiya jadvali",
      description: "Oylik to‘lovlar jadvalini yarating. Shundan keyin shartlar bloklanadi va oylik to‘lovlarni qayd etish ochiladi.",
      done: !!contract,
      blocked: contract ? undefined : cancelled ? "Buyurtma bekor qilingan." : !linked?.has_passport ? "Pasport ma’lumoti bor mijozni biriktiring." : !paymentDone ? "Boshlang‘ich to‘lov to‘liq qayd etilishi kerak." : undefined,
      summary: contract ? `Jadval ${contract.status === "settled" ? "yakunlangan" : "faol"}, ${p.installments?.schedule.length ?? 0} oy.` : undefined,
      content: <OrderInstallments plain endpoint={endpoint} cancelled={cancelled} onChanged={refreshQuiet} version={version} />,
    });
    drafts.push({
      id: "monthly",
      title: "Oylik to‘lovlar",
      description: "Har oylik to‘lovni qayd eting. Tizim uni asosiy kapital va foydaga o‘zi ajratib, moliyalashtirgan investorlarga yozadi.",
      done: contract?.status === "settled",
      blocked: !contract ? "Avval nasiya jadvalini yarating." : undefined,
      summary: "Barcha oylik to‘lovlar olingan, nasiya yakunlangan.",
      content: <OrderInstallments plain endpoint={endpoint} cancelled={cancelled} onChanged={refreshQuiet} version={version} />,
    });
  }

  // The first step that is neither finished nor blocked is the one to act on now.
  let currentFound = false;
  const steps: OrderStep[] = drafts.map(({ done, blocked, ...step }) => {
    let status: StepStatus = done ? "done" : blocked ? "blocked" : "open";
    if (status === "open" && !currentFound && !cancelled) {
      status = "current";
      currentFound = true;
    }
    if (cancelled && step.id === "accept") status = "current";
    return { ...step, status, reason: blocked };
  });

  return (
    <>
      <BackLink />
      <PageHeader title={"Buyurtma " + o.id.slice(0, 8)} description={formatStamp(o.created_at) + " · Manba: " + sourceLabels[o.source] + (website ? " · " + website.reference : "")}>
        <RefreshButton busy={busy} onClick={refreshQuiet} />
      </PageHeader>
      <div className="flex flex-wrap gap-1.5" aria-label="Buyurtma holatlari">
        <RequestBadge status={o.request_status} />
        <SaleBadge status={o.sale_status} />
        <DeliveryBadge status={o.fulfillment_status} />
      </div>
      {cancelled && <Notice>Buyurtma bekor qilingan. Keyingi qadamlar yopiq. Kerak bo‘lsa birinchi qadamda qayta oching.</Notice>}
      <InlineError message={error} />

      {p.website && <OrderWebsite request={p.website} />}

      <Section title="Mahsulotlar">
        <TableFrame>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mahsulot</TableHead>
                <TableHead className="hidden sm:table-cell">Xotira</TableHead>
                <TableHead className="hidden sm:table-cell">Rang</TableHead>
                <TableHead className="text-right">Miqdor</TableHead>
                <TableHead className="text-right">Birlik narxi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.items.map(i => (
                <TableRow key={i.variant_id}>
                  <TableCell className="font-medium whitespace-normal">
                    {i.name}
                    <span className="block font-normal text-muted-foreground sm:hidden">{[i.storage_label, i.color].filter(Boolean).join(" · ")}</span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{i.storage_label ?? "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell">{i.color}</TableCell>
                  <TableCell className="text-right tabular-nums">{i.quantity}</TableCell>
                  <TableCell className="text-right">
                    <Money value={i.unit_price_uzs} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>So‘rov qiymati</TableCell>
                <TableCell colSpan={4} className="text-right">
                  <Money value={total} />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </TableFrame>
      </Section>

      <Section title="Buyurtmani rasmiylashtirish" description="Qadamlar tartib bilan bajariladi. Hozirgi qadam ochiq turadi, bajarilganlarini bosib ko‘rish mumkin.">
        {p.ready ? <OrderSteps steps={steps} /> : <LoadingBlock rows={5} label="Qadamlar yuklanmoqda" />}
      </Section>

      {isAdminRole(role) && <OrderReviews orderId={o.id} version={version} />}

      <ConfirmDialog open={confirmSale} onOpenChange={setConfirmSale} title="Sotuvni tasdiqlaysizmi?" description="Mahsulotlar ombordan chiqariladi. Qaytarish jarayoni hali mavjud emas, shuning uchun bu amalni bekor qilib bo‘lmaydi." confirmLabel="Ombordan chiqarish va tasdiqlash" busy={busy} onConfirm={() => void mutate("POST", endpoint + "/sale", {}, "Sotuv tasdiqlandi.")} />
      <ConfirmDialog open={confirmCancel} onOpenChange={setConfirmCancel} title="Buyurtmani bekor qilasizmi?" description="Bekor qilingan buyurtmada keyingi qadamlar yopiladi. To‘lov qayd etilgan buyurtmani bekor qilib bo‘lmaydi." confirmLabel="Bekor qilish" destructive busy={busy} onConfirm={() => setStatus("cancelled", "Buyurtma bekor qilindi.")} />
    </>
  );
}
