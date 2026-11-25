"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FilmIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";

const MAX = 4 * 1024 * 1024;

/** Upload of the banner's short muted video (MP4 or WebM, up to 4 MB). Mirrors the catalog image upload. */
export function BannerVideoUpload({ value, onChange, disabled, onBusy }: { value: string; onChange: (url: string) => void; disabled: boolean; onBusy: (busy: boolean) => void }) {
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
    if (!["video/mp4", "video/webm"].includes(file.type)) {
      setError("MP4 yoki WebM video tanlang.");
      return;
    }
    if (!file.size || file.size > MAX) {
      setError("Video 4 MB dan oshmasligi kerak. Uni qisqartiring yoki siqib qayta saqlang.");
      return;
    }
    pending.current = true;
    setLoading(true);
    setError("");
    onBusy(true);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const r = await fetch("/api/admin/banner/video", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": file.type }, body: file, signal: abort.signal });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || typeof d.url !== "string" || !d.url.startsWith("/api/banner/video/")) throw new Error(d.error || "Video yuklanmadi");
      if (alive.current) callback.current(d.url);
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "Video yuklanmadi");
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
      <FieldLabel htmlFor={id}>Banner videosi</FieldLabel>
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
        {value ? (
          <video src={value} muted loop autoPlay playsInline aria-hidden="true" className="h-16 w-28 shrink-0 rounded-md bg-muted object-cover" />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" aria-hidden="true">
            {loading ? <Spinner /> : <FilmIcon className="size-5" />}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{loading ? "Video yuklanmoqda…" : value ? "Videoni almashtirish" : "Videoni shu yerga tashlang yoki tanlang"}</span>
          <span className="text-muted-foreground">MP4 yoki WebM, 4 MB gacha. Ovozsiz, takrorlanib ijro etiladi.</span>
        </span>
        <input ref={input} id={id} name="video" type="file" accept="video/mp4,video/webm" className="sr-only" disabled={blocked} onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
      </label>
      {value && (
        <Button type="button" variant="ghost" className="self-start" disabled={blocked} onClick={() => onChange("")}>
          Videoni olib tashlash
        </Button>
      )}
      {loading && <FieldDescription role="status" className="sr-only">Video yuklanmoqda…</FieldDescription>}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}
