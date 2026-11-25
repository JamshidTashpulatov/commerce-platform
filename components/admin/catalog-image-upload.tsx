"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function CatalogImageUpload({ label, value, onChange, disabled, onBusy }: { label: string; value: string; onChange: (url: string) => void; disabled: boolean; onBusy: (busy: boolean) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const alive = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const callback = useRef(onChange);
  callback.current = onChange;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);

  async function upload(file: File) {
    if (disabled || pending.current) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("JPG, PNG yoki WebP formatini tanlang.");
      return;
    }
    if (!file.size || file.size > 3 * 1024 * 1024) {
      setError("Fayl hajmi 3 MB dan oshmasligi kerak.");
      return;
    }
    pending.current = true;
    setLoading(true);
    setError("");
    onBusy(true);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const r = await fetch("/api/admin/catalog/media", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": file.type }, body: file, signal: abort.signal });
      const d = await r.json();
      if (!r.ok || typeof d.url !== "string" || !d.url.startsWith("/api/catalog/media/")) throw new Error(d.error || "Rasm yuklanmadi");
      if (alive.current) callback.current(d.url);
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "Rasm yuklanmadi");
    } finally {
      pending.current = false;
      controller.current = null;
      onBusy(false);
      if (alive.current) {
        setLoading(false);
        if (input.current) input.current.value = "";
      }
    }
  }

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {value && (
        <div className="flex items-center gap-3 rounded-lg border p-2">
          {value.startsWith("/api/catalog/media/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={label} className="size-16 shrink-0 rounded-md bg-muted object-contain" />
          ) : (
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">Tashqi rasm manzili biriktirilgan.</p>
          )}
          <Button type="button" variant="ghost" className="ml-auto" disabled={disabled || loading} onClick={() => onChange("")}>
            Olib tashlash
          </Button>
        </div>
      )}
      <Input ref={input} id={id} name="image" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || loading} onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
      {loading ? (
        <FieldDescription role="status" className="flex items-center gap-1.5">
          <Spinner /> Rasm yuklanmoqda…
        </FieldDescription>
      ) : (
        <FieldDescription>JPG, PNG yoki WebP, 3 MB gacha.</FieldDescription>
      )}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}
