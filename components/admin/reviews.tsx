"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { InlineError, Money, StatusBadge, errorText, formatStamp } from "./kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { staffFetch } from "@/lib/staff-client";

export type ReceiptReview = { id: string; order_id: string; reason: string; amount_uzs: string; opened_at?: string; resolved_at: string | null; resolution: string | null };

/** List of receipt discrepancies (tafovut) with the administrator action that closes one with evidence. */
export function ReviewList({ reviews, showOrder, onResolved }: { reviews: ReceiptReview[]; showOrder?: boolean; onResolved: () => void }) {
  const [selected, setSelected] = useState<ReceiptReview | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = useId();
  useEffect(() => {
    if (selected) {
      setReason("");
      setError("");
    }
  }, [selected]);

  async function resolve() {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      await staffFetch("/api/admin/orders/" + selected.order_id + "/reviews", "POST", { action: "resolve", reviewId: selected.id, reason });
      setSelected(null);
      toast.success("Tafovut yopildi.");
      onResolved();
    } catch (e) {
      setError(errorText(e, "Saqlash imkoni bo‘lmadi"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ul className="flex flex-col divide-y rounded-lg border">
        {reviews.map(r => (
          <li key={r.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="flex min-w-0 flex-col gap-1 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={r.resolved_at ? "success" : "warning"}>{r.resolved_at ? "Yopilgan" : "Ochiq"}</StatusBadge>
                <Money value={r.amount_uzs} className="font-medium" />
                {showOrder && (
                  <Link href={"/staff/orders/" + r.order_id} className="font-mono underline underline-offset-4">
                    {r.order_id.slice(0, 8)}
                  </Link>
                )}
                {r.opened_at && <span className="text-muted-foreground">{formatStamp(r.opened_at)}</span>}
              </div>
              <p className="text-pretty">
                <span className="text-muted-foreground">Sabab: </span>
                {r.reason}
              </p>
              {r.resolution && (
                <p className="text-pretty">
                  <span className="text-muted-foreground">Natija: </span>
                  {r.resolution}
                </p>
              )}
            </div>
            {!r.resolved_at && (
              <Button type="button" variant="outline" className="shrink-0 self-start" onClick={() => setSelected(r)}>
                Tafovutni yopish
              </Button>
            )}
          </li>
        ))}
      </ul>
      <Dialog open={!!selected} onOpenChange={next => !next && !busy && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tafovutni yopish</DialogTitle>
            <DialogDescription>Bu amal faqat tekshiruvni yopadi. Pul harakatini tegishli hisobda alohida qayd eting.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={id}>Dalil</FieldLabel>
            <Textarea id={id} name="resolution" rows={3} maxLength={240} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} placeholder="Masalan: 12.11.2026, 45-sonli qaytim dalolatnomasi" />
            <FieldDescription>Haqiqiy qaytim yoki tasdiqlangan tuzatish hujjatining sanasi va raqami.</FieldDescription>
          </Field>
          <InlineError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setSelected(null)}>
              Ortga
            </Button>
            <Button type="button" disabled={busy || reason.trim().length < 3} onClick={() => void resolve()}>
              {busy && <Spinner data-icon="inline-start" />}
              Tafovutni yopish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
