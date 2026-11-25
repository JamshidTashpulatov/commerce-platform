"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, ErrorState, InlineError, LoadingBlock, Money, PageHeader, RefreshButton, Section, TableFrame, TextField, errorText, isAdminRole, useStaffRole, formatStamp } from "@/components/admin/kit";
import { OrderCapitalReturns } from "@/components/admin/order-capital-returns";
import { OrderCustomer } from "@/components/admin/order-customer";
import { OrderFunding } from "@/components/admin/order-funding";
import { OrderInstallments } from "@/components/admin/order-installments";
import { OrderPayments } from "@/components/admin/order-payments";
import { OrderReviews } from "@/components/admin/order-reviews";
import { DeliveryBadge, RequestBadge, SaleBadge } from "@/components/admin/status";
import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deliveryLabels, requestLabels, sourceLabels, staffFetch, type StaffItem, type StaffOrder } from "@/lib/staff-client";

type Detail = { order: StaffOrder; items: StaffItem[] };

function BackLink() {
  return (
    <Link href="/staff" className={buttonVariants({ variant: "ghost", size: "sm", className: "self-start" })}>
      <ArrowLeftIcon data-icon="inline-start" />
      Buyurtmalar
    </Link>
  );
}

export default function StaffOrderDetails() {
  const { id } = useParams<{ id: string }>();
  const role = useStaffRole();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [status, setStatus] = useState("");
  const [delivery, setDelivery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
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
      setStatus(data.order.request_status);
      setDelivery(data.order.fulfillment_status);
      setConfirm(false);
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

  async function mutate(method: string, path: string, body: Record<string, unknown>, success: string) {
    if (pending.current || !detail) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await staffFetch(path, method, { ...body, revision: detail.order.revision });
      setConfirm(false);
      toast.success(success);
      await refresh();
    } catch (e) {
      setConfirm(false);
      setError(errorText(e, "Saqlash imkoni bo‘lmadi"));
    } finally {
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
  const total = detail.items.reduce((sum, item) => sum + BigInt(item.unit_price_uzs) * BigInt(item.quantity), BigInt(0));
  const refreshQuiet = () => void refresh();

  return (
    <>
      <BackLink />
      <PageHeader title={"Buyurtma " + o.id.slice(0, 8)} description={formatStamp(o.created_at) + " · Manba: " + sourceLabels[o.source]}>
        <RefreshButton busy={busy} onClick={refreshQuiet} />
      </PageHeader>
      <div className="flex flex-wrap gap-1.5" aria-label="Buyurtma holatlari">
        <RequestBadge status={o.request_status} />
        <SaleBadge status={o.sale_status} />
        <DeliveryBadge status={o.fulfillment_status} />
      </div>
      <InlineError message={error} />

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

      <Section title="Jarayon" description="Buyurtma holati, sotuv va yetkazib berish.">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <TextField label="Buyurtma holati" description={sold ? "Sotilgan buyurtma holati o‘zgarmaydi." : undefined}>
              {fieldId => (
                <NativeSelect id={fieldId} name="status" className="w-full" value={status} disabled={busy || sold} onChange={e => setStatus(e.target.value)}>
                  {Object.entries(requestLabels).map(([k, v]) => (
                    <NativeSelectOption key={k} value={k}>
                      {v}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </TextField>
            <Button type="button" variant="outline" size="sm" className="self-start" disabled={busy || status === o.request_status || sold} onClick={() => void mutate("PATCH", endpoint, { status }, "Buyurtma holati saqlandi.")}>
              Holatni saqlash
            </Button>
          </div>
          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">Sotuv</p>
              <div>
                <SaleBadge status={o.sale_status} />
              </div>
              <p className="text-sm text-muted-foreground">Ombor qoldig‘i sotuv tasdiqlanganda kamayadi. Bu amal to‘lovni qayd etmaydi.</p>
            </div>
            {!sold && !cancelled && (
              <Button type="button" size="sm" className="self-start" disabled={busy} onClick={() => setConfirm(true)}>
                Sotuvni tasdiqlash
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <TextField label="Yetkazib berish" description={!sold ? "Avval sotuvni tasdiqlang." : o.fulfillment_status === "delivered" ? "Yetkazilgan buyurtma holati o‘zgarmaydi." : "Yetkazib berish bepul."}>
              {fieldId => (
                <NativeSelect id={fieldId} name="fulfillment" className="w-full" value={delivery} disabled={busy || !sold || o.fulfillment_status === "delivered"} onChange={e => setDelivery(e.target.value)}>
                  {Object.entries(deliveryLabels).map(([k, v]) => (
                    <NativeSelectOption key={k} value={k}>
                      {v}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </TextField>
            <Button type="button" variant="outline" size="sm" className="self-start" disabled={busy || delivery === o.fulfillment_status || !sold || o.fulfillment_status === "delivered"} onClick={() => void mutate("PUT", endpoint, { fulfillment: delivery }, "Yetkazib berish holati saqlandi.")}>
              Yetkazish holatini saqlash
            </Button>
          </div>
        </div>
      </Section>

      <OrderCustomer endpoint={endpoint} cancelled={cancelled} onLinked={refreshQuiet} />
      <OrderPayments endpoint={endpoint} cancelled={cancelled} onChanged={refreshQuiet} />
      <OrderInstallments version={version} endpoint={endpoint} cancelled={cancelled} onChanged={refreshQuiet} />
      <OrderFunding version={version} endpoint={endpoint} locked={sold || cancelled} />
      <OrderCapitalReturns version={version} endpoint={endpoint} onChanged={refreshQuiet} />
      {isAdminRole(role) && <OrderReviews orderId={o.id} version={version} />}

      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Sotuvni tasdiqlaysizmi?" description="Mahsulotlar ombordan chiqariladi. Qaytarish jarayoni hali mavjud emas, shuning uchun bu amalni bekor qilib bo‘lmaydi." confirmLabel="Ombordan chiqarish va tasdiqlash" busy={busy} onConfirm={() => void mutate("POST", endpoint + "/sale", {}, "Sotuv tasdiqlandi.")} />
    </>
  );
}
