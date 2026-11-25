"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";
import { BannerVideoUpload } from "@/components/admin/banner-video-upload";
import { CatalogImageUpload } from "@/components/admin/catalog-image-upload";
import { ErrorState, InlineError, LoadingBlock, Notice, PageHeader, RefreshButton, Section, SubmitButton, TextField, errorText, formatStamp } from "@/components/admin/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { staffFetch } from "@/lib/staff-client";

type Form = { eyebrow: string; title: string; subtitle: string; imageUrl: string; videoUrl: string; primaryLabel: string; primaryHref: string; secondaryLabel: string; secondaryHref: string; published: boolean };
type Saved = Omit<Form, "imageUrl" | "videoUrl"> & { imageUrl: string | null; videoUrl: string | null; revision: number; updatedAt: string };
type Data = { banner: Saved | null; enabled: boolean };
const empty: Form = { eyebrow: "", title: "", subtitle: "", imageUrl: "", videoUrl: "", primaryLabel: "", primaryHref: "", secondaryLabel: "", secondaryHref: "", published: false };

export default function BannerAdmin() {
  const [data, setData] = useState<Data | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const pending = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const fresh = await staffFetch<Data>("/api/admin/banner");
      setData(fresh);
      setForm(fresh.banner ? { ...fresh.banner, imageUrl: fresh.banner.imageUrl ?? "", videoUrl: fresh.banner.videoUrl ?? "" } : empty);
    } catch (e) {
      setData(null);
      setLoadError(errorText(e, "Banner yuklanmadi"));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(f => ({ ...f, [key]: value }));
  const locked = busy || uploading;

  async function save() {
    if (!data?.enabled || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await staffFetch("/api/admin/banner", "POST", { ...form, imageUrl: form.imageUrl.trim() || null, videoUrl: form.videoUrl || null, revision: data.banner?.revision ?? null });
      toast.success(form.published ? "Banner saqlandi va saytda ko‘rinadi." : "Banner qoralama sifatida saqlandi.");
      await load();
    } catch (e) {
      setError(errorText(e, "Saqlanmadi"));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const header = (
    <PageHeader title="Bosh sahifa banneri" description="Saytning bosh sahifasi tepasidagi katta blok: sarlavha, matn, rasm va tugmalar.">
      <RefreshButton busy={loading} onClick={() => void load()} />
      <Button variant="outline" nativeButton={false} render={<a href="/" target="_blank" rel="noopener noreferrer" />}>
        <ExternalLinkIcon data-icon="inline-start" />
        Saytda ko‘rish
      </Button>
    </PageHeader>
  );
  if (loading && !data) return <>{header}<LoadingBlock rows={5} label="Banner yuklanmoqda" /></>;
  if (!data) return <>{header}<ErrorState message={loadError || "Banner yuklanmadi"} onRetry={() => void load()} /></>;

  return (
    <>
      {header}
      {!data.enabled && <Notice>Katalog tahriri server sozlamalarida o‘chirilgan. Bannerni faqat ko‘rish mumkin.</Notice>}
      {!data.banner?.published && <Notice>Banner e’lon qilinmaguncha bosh sahifada eng qimmat iPhone ko‘rsatiladi.</Notice>}
      <form
        className="flex flex-col gap-6"
        onSubmit={e => {
          e.preventDefault();
          void save();
        }}
      >
        <Section title="Matn" description={data.banner ? "Oxirgi o‘zgarish: " + formatStamp(data.banner.updatedAt) : "Banner hali saqlanmagan."}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Kichik sarlavha" description="Sarlavha ustidagi qisqa yozuv, masalan “Yangi”. Ixtiyoriy.">
              {id => <Input id={id} name="eyebrow" maxLength={40} disabled={locked} value={form.eyebrow} onChange={e => set("eyebrow", e.target.value)} />}
            </TextField>
            <TextField label="Sarlavha">{id => <Input id={id} name="title" required maxLength={80} disabled={locked} value={form.title} onChange={e => set("title", e.target.value)} />}</TextField>
          </div>
          <TextField label="Matn" description="Sarlavha ostidagi bir-ikki jumla. Ixtiyoriy.">
            {id => <Textarea id={id} name="subtitle" maxLength={200} rows={2} disabled={locked} value={form.subtitle} onChange={e => set("subtitle", e.target.value)} />}
          </TextField>
        </Section>

        <Section title="Rasm va video" description="Video bo‘lsa, u rasm o‘rnida ijro etiladi, rasm esa video yuklanguncha va harakatni kamaytirish yoqilgan qurilmalarda ko‘rinadi. Fon rangi rasm chetidan olinadi, shuning uchun rasmni videoning birinchi kadridan olgan ma’qul.">
          <div className="grid gap-4 sm:grid-cols-2">
            <CatalogImageUpload label="Banner rasmi" value={form.imageUrl} disabled={locked || !data.enabled} onBusy={setUploading} onChange={url => set("imageUrl", url)} />
            <BannerVideoUpload value={form.videoUrl} disabled={locked || !data.enabled} onBusy={setUploading} onChange={url => set("videoUrl", url)} />
          </div>
        </Section>

        <Section title="Tugmalar" description="Havola “/” bilan boshlanadigan sayt sahifasi (masalan, /catalog?category=iPhone) yoki https manzil. Kerak bo‘lmasa, ikkala maydonni bo‘sh qoldiring.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Asosiy tugma matni">{id => <Input id={id} name="primaryLabel" maxLength={30} disabled={locked} placeholder="Batafsil" value={form.primaryLabel} onChange={e => set("primaryLabel", e.target.value)} />}</TextField>
            <TextField label="Asosiy tugma havolasi">{id => <Input id={id} name="primaryHref" maxLength={300} disabled={locked} placeholder="/products/…" value={form.primaryHref} onChange={e => set("primaryHref", e.target.value)} />}</TextField>
            <TextField label="Ikkinchi tugma matni">{id => <Input id={id} name="secondaryLabel" maxLength={30} disabled={locked} placeholder="Barcha iPhone" value={form.secondaryLabel} onChange={e => set("secondaryLabel", e.target.value)} />}</TextField>
            <TextField label="Ikkinchi tugma havolasi">{id => <Input id={id} name="secondaryHref" maxLength={300} disabled={locked} placeholder="/catalog?category=iPhone" value={form.secondaryHref} onChange={e => set("secondaryHref", e.target.value)} />}</TextField>
          </div>
        </Section>

        <Section title="E’lon">
          <TextField label="Holati" description="E’lon qilingan banner darhol bosh sahifada ko‘rinadi.">
            {id => (
              <NativeSelect id={id} name="published" className="w-full sm:w-64" disabled={locked} value={form.published ? "published" : "draft"} onChange={e => set("published", e.target.value === "published")}>
                <NativeSelectOption value="draft">Qoralama</NativeSelectOption>
                <NativeSelectOption value="published">E’lon qilingan</NativeSelectOption>
              </NativeSelect>
            )}
          </TextField>
        </Section>

        <InlineError message={error} />
        <SubmitButton busy={busy} disabled={!data.enabled || locked || !form.title.trim()} className="self-start">
          Bannerni saqlash
        </SubmitButton>
      </form>
    </>
  );
}
