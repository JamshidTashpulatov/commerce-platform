"use client";

import { ImageUpIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";

export function CatalogImageUpload({ label, value, onChange, disabled, onBusy }: { label: string; value: string; onChange: (url: string) => void; disabled: boolean; onBusy: (busy: boolean) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
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

  const blocked = disabled || loading;
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <label
        htmlFor={id}
        data-dragging={dragging || undefined}
        aria-disabled={blocked || undefined}
        className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-3 text-sm transition-colors hover:bg-fill-1 has-focus-visible:ring-2 has-focus-visible:ring-ring/30 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 data-dragging:border-primary data-dragging:bg-fill-1"
        onDragOver={e => {
          e.preventDefault();
          if (!blocked) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !blocked) void upload(f);
        }}
      >
        {value && value.startsWith("/api/catalog/media/") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="size-16 shrink-0 rounded-md bg-muted object-contain" />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" aria-hidden="true">
            {loading ? <Spinner /> : <ImageUpIcon className="size-5" />}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{loading ? "Rasm yuklanmoqda…" : value ? "Rasmni almashtirish" : "Rasmni shu yerga tashlang yoki tanlang"}</span>
          <span className="text-muted-foreground">{value && !value.startsWith("/api/catalog/media/") ? "Tashqi rasm manzili biriktirilgan." : "JPG, PNG yoki WebP, 3 MB gacha."}</span>
        </span>
        <input ref={input} id={id} name="image" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={blocked} onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
      </label>
      {value && (
        <Button type="button" variant="ghost" className="self-start" disabled={blocked} onClick={() => onChange("")}>
          Rasmni olib tashlash
        </Button>
      )}
      {loading && <FieldDescription role="status" className="sr-only">Rasm yuklanmoqda…</FieldDescription>}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}
