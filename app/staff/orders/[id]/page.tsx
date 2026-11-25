"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeftIcon, EllipsisIcon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, ErrorState, InlineError, LoadingBlock, Money, Notice, Stat, StatGrid, StatusBadge, TableFrame, errorText, formatDay, formatStamp, isAdminRole, useStaffRole } from "@/components/admin/kit";
import { Block, HistoryBlock, InvestorsBlock, PaymentsBlock, ProgressLine } from "@/components/admin/order-blocks";
import { OrderCapitalReturns } from "@/components/admin/order-capital-returns";
import { OrderCustomer } from "@/components/admin/order-customer";
import { OrderFunding } from "@/components/admin/order-funding";
import { OrderInstallments } from "@/components/admin/order-installments";
import { OrderPayments } from "@/components/admin/order-payments";
import { useOrderProgress } from "@/components/admin/order-progress";
import { OrderReviews } from "@/components/admin/order-reviews";
import { OrderWebsite } from "@/components/admin/order-website";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deliveryLabels, sourceLabels, staffFetch, type StaffItem, type StaffOrder } from "@/lib/staff-client";

type Detail = { order: StaffOrder; items: StaffItem[] };
/** The one thing open in a dialog. Every action is a short dialog over the page, never a permanent section. */
type Sheet = { kind: "customer" | "terms" | "receipt" | "funding" | "returns" | "schedule" } | { kind: "month"; id: string } | { kind: "correct"; of: "manual" | "month"; id: string } | null;
type Tone = "neutral" | "success" | "warning" | "danger" | "info";

function BackLink() {
  return (
    <Link href="/staff" className={buttonVariants({ variant: "ghost", className: "self-start" })}>
      <ArrowLeftIcon data-icon="inline-start" />
      Buyurtmalar
    </Link>
  );
}

function ActionDialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={next => !next && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-2xl [&_[data-section-action]]:hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export default function StaffOrderDetails() {
  const { id } = useParams<{ id: string }>();
  const role = useStaffRole();
  const admin = isAdminRole(role);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
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

  const { progress: p } = useOrderProgress(endpoint, version, detail?.order.source === "website");

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
  const refreshQuiet = () => void refresh();
  const close = () => setSheet(null);
  const done = () => {
    setSheet(null);
    refreshQuiet();
  };
  const setStatus = (status: string, message: string) => void mutate("PATCH", endpoint, { status }, message);
  const setDelivery = (fulfillment: string) => void mutate("PUT", endpoint, { fulfillment }, "Yetkazib berish holati saqlandi.");

  // Where the order stands, read from the same data the blocks show.
  const terms = p.payments?.terms ?? null;
  const installment = terms?.payment_type === "installment";
  const linked = p.customer?.linked ?? null;
  const itemsTotal = detail.items.reduce((sum, item) => sum + BigInt(item.unit_price_uzs) * BigInt(item.quantity), BigInt(0));
  const total = terms ? BigInt(terms.agreed_total_uzs) : itemsTotal;
  const paid = BigInt(p.payments?.received_uzs ?? "0");
  const firstTarget = terms ? BigInt(installment ? terms.initial_due_uzs : terms.agreed_total_uzs) : BigInt(0);
  const manualReceived = BigInt(p.payments?.manual_received_uzs ?? "0");
  const firstPaid = !!terms && manualReceived >= firstTarget && firstTarget > BigInt(0);
  const principal = p.funding?.principal ? BigInt(p.funding.principal) : null;
  const funded = (p.funding?.allocations ?? []).reduce((n, a) => n + BigInt(a.amount_uzs), BigInt(0));
  const fundingDone = principal !== null && funded === principal;
  const contract = p.installments?.contract ?? null;
  const settled = installment ? contract?.status === "settled" : !!terms && paid >= total;
  const nextMonth = contract?.status === "active" ? p.installments?.schedule.find(r => r.state !== "paid") : undefined;
  const unposted = (p.returns?.receipts ?? []).filter(r => !r.posted).length;
  const canPostReturns = installment && !!p.returns?.canPost && sold && fundingDone && unposted > 0;
  const website = p.website?.checkout ?? null;
  const first = detail.items[0];

  // One status for the whole order. The three underlying fields stay in the data and appear as small facts.
  const status: { label: string; tone: Tone } = cancelled
    ? { label: "Bekor qilingan", tone: "danger" }
    : sold && settled && delivered
      ? { label: "Yopilgan", tone: "success" }
      : sold && contract?.status === "active" && delivered
        ? { label: "Nasiya to‘lanmoqda", tone: "info" }
        : delivered
          ? { label: "Yetkazilgan", tone: "success" }
          : sold
            ? { label: "Sotilgan", tone: "info" }
            : o.request_status === "in_progress"
              ? { label: "Qabul qilingan", tone: "warning" }
              : { label: "Yangi", tone: "warning" };

  // The next thing to do, chosen from the order's state. Everything else stays reachable in its block.
  type Step = { label: string; done: boolean; action?: { label: string; run: () => void }; skip?: boolean };
  const steps: Step[] = [
    { label: "Qabul", done: o.request_status === "in_progress" || sold, action: { label: "Qabul qilish", run: () => setStatus("in_progress", "Buyurtma qabul qilindi.") } },
    { label: "Mijoz", done: !!linked, skip: !p.customer, action: { label: "Mijozni biriktirish", run: () => setSheet({ kind: "customer" }) } },
    { label: "Shartlar", done: !!terms, action: { label: "To‘lov shartlari", run: () => setSheet({ kind: "terms" }) } },
    { label: installment ? "Boshlang‘ich to‘lov" : "To‘lov", done: firstPaid, action: { label: "To‘lov qo‘shish", run: () => setSheet({ kind: "receipt" }) } },
    // Only the administrator assigns investors, so a seller's next action moves on.
    { label: "Investorlar", done: fundingDone, skip: principal === null || !p.funding?.enabled, action: admin && !sold ? { label: "Investorlarni biriktirish", run: () => setSheet({ kind: "funding" }) } : undefined },
    { label: "Sotuv", done: sold, action: { label: "Sotuvni tasdiqlash", run: () => setConfirmSale(true) } },
    { label: "Jadval", done: !!contract, skip: !installment, action: { label: "Nasiya jadvalini yaratish", run: () => setSheet({ kind: "schedule" }) } },
    { label: "Yetkazish", done: delivered, action: sold ? { label: "Yetkazildi deb belgilash", run: () => setDelivery("delivered") } : undefined },
    { label: "Oylik to‘lovlar", done: contract?.status === "settled", skip: !installment, action: nextMonth ? { label: "To‘lov qo‘shish", run: () => setSheet({ kind: "month", id: nextMonth.id }) } : undefined },
  ].filter(s => !s.skip);
  const next = cancelled ? undefined : (canPostReturns ? { label: "Qaytim", done: false, action: { label: "Kapital qaytimini tasdiqlash", run: () => setSheet({ kind: "returns" }) } } : undefined) ?? steps.find(s => !s.done && s.action);
  const currentLabel = steps.find(s => !s.done)?.label;

  return (
    <>
      <BackLink />
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-balance">
              {first ? first.name : "Buyurtma"}
              {detail.items.length > 1 && <span className="text-muted-foreground"> va yana {detail.items.length - 1} ta</span>}
            </h1>
            <p className="text-sm text-muted-foreground">
              {first && [first.storage_label, first.color, first.quantity > 1 ? first.quantity + " dona" : null].filter(Boolean).join(" · ")}
              {first && " · "}№ {o.id.slice(0, 8)} · {formatStamp(o.created_at)} · {sourceLabels[o.source]}
              {website ? " · " + website.reference : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="max-sm:hidden">
              <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon" aria-label="Boshqa amallar" />}>
                <EllipsisIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-60">
                <DropdownMenuGroup>
                  <DropdownMenuItem disabled={busy} onClick={refreshQuiet}>
                    Yangilash
                  </DropdownMenuItem>
                  {sold && !delivered && o.fulfillment_status !== "in_transit" && (
                    <DropdownMenuItem disabled={busy} onClick={() => setDelivery("in_transit")}>
                      Yo‘lda deb belgilash
                    </DropdownMenuItem>
                  )}
                  {!sold && o.request_status === "in_progress" && (
                    <DropdownMenuItem disabled={busy} onClick={() => setStatus("new", "Buyurtma «Yangi» holatiga qaytarildi.")}>
                      «Yangi» holatiga qaytarish
                    </DropdownMenuItem>
                  )}
                  {cancelled && (
                    <DropdownMenuItem disabled={busy} onClick={() => setStatus("in_progress", "Buyurtma qayta ochildi.")}>
                      Qayta ochish
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
                {!sold && !cancelled && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem variant="destructive" disabled={busy} onClick={() => setConfirmCancel(true)}>
                        Buyurtmani bekor qilish
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="sm:hidden">
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </div>
        <p className="text-sm">
          <span className="text-muted-foreground">Mijoz: </span>
          {linked ? (
            <span className="font-medium">
              {linked.name} <span className="font-normal text-muted-foreground tabular-nums">{linked.phone_masked}</span>
            </span>
          ) : website ? (
            <span className="font-medium">
              {website.name} <span className="font-normal text-muted-foreground tabular-nums">{website.phone}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">biriktirilmagan</span>
          )}
          {sold && (
            <span className="text-muted-foreground">
              {" "}
              · {deliveryLabels[o.fulfillment_status] ?? o.fulfillment_status}
            </span>
          )}
        </p>
      </header>

      <StatGrid className="grid-cols-3 xl:grid-cols-3">
        <Stat label="Jami" value={<Money value={total} />} hint={terms ? (installment ? `Nasiya, ${terms.term_months} oy` : "To‘liq to‘lov") : "Shartlar kiritilmagan"} />
        <Stat label="To‘langan" value={<Money value={paid} />} />
        <Stat label="Qoldiq" value={<Money value={terms ? total - paid : null} />} tone={terms && total - paid > BigInt(0) ? "default" : "muted"} hint={nextMonth ? `Keyingi: ${formatDay(nextMonth.due_date)}` : undefined} />
      </StatGrid>

      {p.ready ? (
        <div className="flex flex-col gap-3">
          {next?.action && (
            <Button type="button" size="lg" className="self-start max-sm:w-full" disabled={busy} onClick={next.action.run}>
              {next.action.label}
            </Button>
          )}
          <ProgressLine steps={steps.map(s => ({ label: s.label, done: s.done, current: !cancelled && s.label === currentLabel }))} />
        </div>
      ) : (
        <LoadingBlock rows={2} label="Holat yuklanmoqda" />
      )}
      {cancelled && <Notice>Buyurtma bekor qilingan.</Notice>}
      <InlineError message={error} />

      {p.website && <OrderWebsite request={p.website} />}

      {detail.items.length > 1 && (
        <Block title="Mahsulotlar">
          <TableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mahsulot</TableHead>
                  <TableHead className="text-right">Miqdor</TableHead>
                  <TableHead className="text-right">Narxi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.items.map(i => (
                  <TableRow key={i.variant_id}>
                    <TableCell className="font-medium whitespace-normal">
                      {i.name}
                      <span className="block font-normal text-muted-foreground">{[i.storage_label, i.color].filter(Boolean).join(" · ")}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{i.quantity}</TableCell>
                    <TableCell className="text-right">
                      <Money value={i.unit_price_uzs} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableFrame>
        </Block>
      )}

      {terms && p.payments && (
        <Block
          title="To‘lovlar"
          action={
            !p.payments.receipts.length && !p.payments.has_schedule && !cancelled ? (
              <Button type="button" variant="outline" onClick={() => setSheet({ kind: "terms" })}>
                Shartlarni o‘zgartirish
              </Button>
            ) : installment && !contract && !cancelled ? (
              <Button type="button" variant="outline" onClick={() => setSheet({ kind: "schedule" })}>
                Jadval yaratish
              </Button>
            ) : undefined
          }
        >
          <PaymentsBlock progress={p} cancelled={cancelled} onPay={t => setSheet(t.kind === "manual" ? { kind: "receipt" } : { kind: "month", id: t.id })} onCorrect={r => setSheet({ kind: "correct", of: r.kind, id: r.id })} />
        </Block>
      )}

      {terms && principal !== null && p.funding?.enabled && (
        <Block
          title="Investorlar"
          action={
            admin ? (
              <span className="flex flex-wrap justify-end gap-2">
                {canPostReturns && (
                  <Button type="button" variant="outline" onClick={() => setSheet({ kind: "returns" })}>
                    Qaytimni tasdiqlash
                  </Button>
                )}
                {!sold && !cancelled && (
                  <Button type="button" variant="outline" onClick={() => setSheet({ kind: "funding" })}>
                    {funded > BigInt(0) ? "O‘zgartirish" : "Biriktirish"}
                  </Button>
                )}
              </span>
            ) : undefined
          }
        >
          <InvestorsBlock data={p.investors} />
        </Block>
      )}

      {p.customer && (
        <Block
          title="Mijoz"
          action={
            !linked && !cancelled ? (
              <Button type="button" variant="outline" onClick={() => setSheet({ kind: "customer" })}>
                Biriktirish
              </Button>
            ) : undefined
          }
        >
          {linked ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border p-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Ism</dt>
                <dd className="font-medium">{linked.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Telefon</dt>
                <dd className="font-medium tabular-nums">{linked.phone_masked}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Pasport</dt>
                <dd className="font-medium">{linked.has_passport ? "Kiritilgan" : "Kiritilmagan"}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Mijoz biriktirilmagan.</p>
          )}
        </Block>
      )}

      {admin && <OrderReviews orderId={o.id} version={version} hideEmpty />}
      <HistoryBlock events={p.history} />

      <ActionDialog open={sheet?.kind === "customer"} title="Mijoz" onClose={close}>
        <OrderCustomer plain endpoint={endpoint} cancelled={cancelled} onLinked={done} websiteContact={website && !linked ? { name: website.name, phone: website.phone, existing: !!p.website?.existing_customer } : null} />
      </ActionDialog>
      <ActionDialog open={sheet?.kind === "terms"} title="To‘lov shartlari" onClose={close}>
        <OrderPayments plain part="terms" endpoint={endpoint} cancelled={cancelled} onChanged={refreshQuiet} onDone={close} />
      </ActionDialog>
      <ActionDialog open={sheet?.kind === "receipt"} title={installment ? "Boshlang‘ich to‘lov" : "To‘lov qo‘shish"} onClose={close}>
        <OrderPayments plain part="form" endpoint={endpoint} cancelled={cancelled} onChanged={refreshQuiet} onDone={close} />
      </ActionDialog>
      <ActionDialog open={sheet?.kind === "funding"} title="Investorlar" onClose={close}>
        <OrderFunding plain endpoint={endpoint} locked={sold || cancelled} cash={!installment} onChanged={done} />
      </ActionDialog>
      <ActionDialog open={sheet?.kind === "returns"} title="Kapital qaytimi" onClose={close}>
        <OrderCapitalReturns plain endpoint={endpoint} onChanged={refreshQuiet} version={version} />
      </ActionDialog>
      <ActionDialog open={sheet?.kind === "schedule"} title="Nasiya jadvali" onClose={close}>
        <OrderInstallments plain endpoint={endpoint} cancelled={cancelled} onChanged={done} version={version} />
      </ActionDialog>
      {sheet?.kind === "month" && <OrderInstallments only="pay" target={sheet.id} endpoint={endpoint} cancelled={cancelled} onChanged={refreshQuiet} onDone={close} />}
      {sheet?.kind === "correct" && sheet.of === "month" && <OrderInstallments only="correct" target={sheet.id} endpoint={endpoint} cancelled={cancelled} onChanged={refreshQuiet} onDone={close} />}
      {sheet?.kind === "correct" && sheet.of === "manual" && <OrderPayments part="correct" target={sheet.id} endpoint={endpoint} cancelled={cancelled} onChanged={refreshQuiet} onDone={close} />}

      <ConfirmDialog open={confirmSale} onOpenChange={setConfirmSale} title="Sotuvni tasdiqlaysizmi?" description="Mahsulot ombordan chiqariladi. Bu amalni bekor qilib bo‘lmaydi." confirmLabel="Sotuvni tasdiqlash" busy={busy} onConfirm={() => void mutate("POST", endpoint + "/sale", {}, "Sotuv tasdiqlandi.")}>
        {principal !== null && !fundingDone && <Notice>Investorlar biriktirilmagan. Sotuvdan keyin ularni biriktirib bo‘lmaydi.</Notice>}
        {terms && !firstPaid && <Notice>{installment ? "Boshlang‘ich to‘lov" : "To‘lov"} hali to‘liq qayd etilmagan.</Notice>}
      </ConfirmDialog>
      <ConfirmDialog open={confirmCancel} onOpenChange={setConfirmCancel} title="Buyurtmani bekor qilasizmi?" description="To‘lov qayd etilgan buyurtmani bekor qilib bo‘lmaydi." confirmLabel="Bekor qilish" destructive busy={busy} onConfirm={() => setStatus("cancelled", "Buyurtma bekor qilindi.")} />
    </>
  );
}
