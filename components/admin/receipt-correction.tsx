"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { InlineError } from "./kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

/**
 * Correction of a wrongly recorded receipt (administrator only).
 * Two outcomes: reverse the record, or, when the server refuses because the capital
 * was already reused or profit distributed, open a discrepancy (tafovut) for the cashbook.
 */
export function ReceiptCorrectionDialog({ open, summary, busy, error, onClose, onReverse, onReview }: { open: boolean; summary: ReactNode; busy: boolean; error: string; onClose: () => void; onReverse: (reason: string) => void; onReview: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const id = useId();
  useEffect(() => {
    if (open) setReason("");
  }, [open]);
  const ok = reason.trim().length >= 3;
  return (
    <Dialog open={open} onOpenChange={next => !next && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xato qaydni tuzatish</DialogTitle>
          <DialogDescription>Bu pulni qaytarish amali emas. Faqat tizimdagi yozuv tuzatiladi.</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">{summary}</div>
        <Field>
          <FieldLabel htmlFor={id}>Sabab</FieldLabel>
          <Textarea id={id} name="reason" rows={3} maxLength={240} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} placeholder="Masalan: summa noto‘g‘ri kiritilgan" />
          <FieldDescription>Kamida 3 belgi. Agar kapital qayta ishlatilgan yoki foyda taqsimlangan bo‘lsa, qaydni bekor qilib bo‘lmaydi. Bunday holda tafovut oching va uni Kassa bo‘limida dalil bilan yoping.</FieldDescription>
        </Field>
        <InlineError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Ortga
          </Button>
          <Button type="button" variant="outline" disabled={busy || !ok} onClick={() => onReview(reason)}>
            Tafovut ochish
          </Button>
          <Button type="button" variant="destructive" disabled={busy || !ok} onClick={() => onReverse(reason)}>
            {busy && <Spinner data-icon="inline-start" />}
            Qaydni bekor qilish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
