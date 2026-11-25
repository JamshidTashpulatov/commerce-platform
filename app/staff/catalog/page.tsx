"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, PencilIcon, PlusIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { CatalogImageUpload } from "@/components/admin/catalog-image-upload";
import { CatalogOptionEditor } from "@/components/admin/catalog-option-editor";
import { EmptyState, ErrorState, InlineError, LoadingBlock, Money, MoneyInput, Notice, PageHeader, RefreshButton, Section, StatusBadge, SubmitButton, TableFrame, TextField, errorText } from "@/components/admin/kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { validSelection, type OptionGroup, type OptionSelection } from "@/lib/catalog-options";
import { staffFetch } from "@/lib/staff-client";

type Product = { id: string; name: string; category: string; description: string; image_url: string | null; published: boolean; revision: number; option_groups: OptionGroup[] };
type Variant = { id: string; product_id: string; sku: string; color: string; storage_label: string | null; price_uzs: string; quantity: number; active: boolean; revision: number; option_values: OptionSelection; image_url: string | null };
type Data = { products: Product[]; variants: Variant[]; enabled: boolean; truncated: boolean };
const emptyProduct = { name: "", category: "", description: "", imageUrl: "", published: false, optionGroups: [] as OptionGroup[] };
const emptyVariant = { sku: "", color: "", storage: "", price: "", active: true, optionValues: {} as OptionSelection, imageUrl: "" };
const describe = (v: Variant) => (Object.keys(v.option_values).length ? Object.entries(v.option_values).map(([k, val]) => k + ": " + val).join(" · ") : [v.color, v.storage_label].filter(Boolean).join(" · "));

export default function CatalogAdmin() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "editor">("list");
  const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [variantOpen, setVariantOpen] = useState(false);
  const [variantEditing, setVariantEditing] = useState<Variant | null>(null);
  const [variantForm, setVariantForm] = useState(emptyVariant);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [addedCategories, setAddedCategories] = useState<string[]>([]);
  const last = useRef<{ signature: string; key: string } | null>(null);
  const pending = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setData(await staffFetch<Data>("/api/admin/catalog"));
    } catch (e) {
      setData(null);
      setLoadError(errorText(e, "Katalog yuklanmadi"));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const enabled = !!data?.enabled && !busy && !loading && !uploading;
  const locked = uploading || busy;
  const product = data?.products.find(p => p.id === selected);
  const variants = data?.variants.filter(v => v.product_id === selected) ?? [];
  const filtered = data?.products.filter(p => (p.name + " " + p.category).toLowerCase().includes(search.toLowerCase().trim())) ?? [];

  function select(p: Product) {
    setSelected(p.id);
    setEditing(p);
    setProductForm({ name: p.name, category: p.category, description: p.description, imageUrl: p.image_url ?? "", published: p.published, optionGroups: p.option_groups });
    setError("");
    setView("editor");
  }
  function create() {
    setSelected("");
    setEditing(null);
    setProductForm(emptyProduct);
    setError("");
    setView("editor");
  }
  function openVariant(v: Variant | null) {
    setVariantEditing(v);
    setVariantForm(v ? { sku: v.sku, color: v.color, storage: v.storage_label ?? "", price: v.price_uzs, active: v.active, optionValues: v.option_values, imageUrl: v.image_url ?? "" } : emptyVariant);
    setError("");
    setVariantOpen(true);
  }

  async function save(body: Record<string, unknown>, done: (id: string) => void) {
    if (!enabled || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const signature = JSON.stringify(body);
      if (last.current?.signature !== signature) last.current = { signature, key: crypto.randomUUID() };
      const r = await staffFetch<{ id: string }>("/api/admin/catalog", "POST", { ...body, key: last.current.key });
      last.current = null;
      const fresh = await staffFetch<Data>("/api/admin/catalog");
      setData(fresh);
      done(r.id);
      toast.success("O‘zgarishlar saqlandi.");
      if (body.action === "createProduct" || body.action === "updateProduct") {
        const p = fresh.products.find(p => p.id === r.id);
        if (p) select(p);
        else create();
      }
    } catch (e) {
      setError(errorText(e, "Saqlanmadi"));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  // Categories are the distinct values already used by products, plus ones added in this session.
  const categories = [...new Set([...(data?.products.map(p => p.category) ?? []), ...addedCategories, productForm.category].filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const categoryName = newCategory.trim();
  const categoryExists = categories.some(c => c.toLowerCase() === categoryName.toLowerCase());
  function addCategory() {
    if (!categoryName) return;
    const existing = categories.find(c => c.toLowerCase() === categoryName.toLowerCase());
    if (!existing) setAddedCategories(list => [...list, categoryName]);
    setProductForm(p => ({ ...p, category: existing ?? categoryName }));
    setCategoryOpen(false);
  }
  const productValid = !!productForm.name.trim() && !!productForm.category.trim();
  const variantValid = !!product && !!variantForm.sku.trim() && (product.option_groups.length ? validSelection(product.option_groups, variantForm.optionValues) : !!variantForm.color.trim()) && /^[1-9][0-9]{0,11}$/.test(variantForm.price);

  if (loading && !data) return <><PageHeader title="Mahsulotlar" /><LoadingBlock rows={6} label="Katalog yuklanmoqda" /></>;
  if (!data) return <><PageHeader title="Mahsulotlar" /><ErrorState message={loadError || "Katalog yuklanmadi"} onRetry={() => void load()} /></>;

  if (view === "list")
    return (
      <>
        <PageHeader title="Mahsulotlar" description="Mahsulot, variant, narx va e’lon holati. Ombor qoldig‘i kirim va sotuv orqali o‘zgaradi.">
          <RefreshButton busy={loading} onClick={() => void load()} />
          <Button type="button" onClick={create}>
            <PlusIcon data-icon="inline-start" />
            Yangi mahsulot
          </Button>
        </PageHeader>
        {!data.enabled && <Notice>Katalog tahriri server sozlamalarida o‘chirilgan. Ma’lumotlarni faqat ko‘rish mumkin.</Notice>}
        {data.truncated && <Notice>Ro‘yxat cheklangan. Barcha mahsulotlar ko‘rinmayotgan bo‘lishi mumkin.</Notice>}
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input type="search" name="search" aria-label="Mahsulot qidirish" placeholder="Nomi yoki kategoriya" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {filtered.length ? (
          <TableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mahsulot</TableHead>
                  <TableHead>Kategoriya</TableHead>
                  <TableHead className="text-right">Variantlar</TableHead>
                  <TableHead>E’lon holati</TableHead>
                  <TableHead className="text-right">Amal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.category}</TableCell>
                    <TableCell className="text-right tabular-nums">{data.variants.filter(v => v.product_id === p.id).length}</TableCell>
                    <TableCell>
                      <StatusBadge tone={p.published ? "success" : "neutral"}>{p.published ? "E’lon qilingan" : "Qoralama"}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="secondary" onClick={() => select(p)}>
                        <PencilIcon data-icon="inline-start" />
                        Tahrirlash
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableFrame>
        ) : (
          <EmptyState title={search ? "Mahsulot topilmadi" : "Katalog bo‘sh"} description={search ? "Qidiruv so‘zini o‘zgartirib ko‘ring." : "Birinchi mahsulotni qo‘shing."} />
        )}
      </>
    );

  return (
    <>
      <Button type="button" variant="ghost" className="self-start" disabled={locked} onClick={() => setView("list")}>
        <ArrowLeftIcon data-icon="inline-start" />
        Mahsulotlar
      </Button>
      <PageHeader title={editing ? editing.name : "Yangi mahsulot"} description={editing ? "Mahsulot ma’lumotlari, xususiyatlari va variantlari." : "Avval mahsulotni saqlang, keyin variant qo‘shasiz."} />
      {!data.enabled && <Notice>Katalog tahriri server sozlamalarida o‘chirilgan.</Notice>}
      <Section title="Mahsulot ma’lumotlari">
        <form
          className="flex flex-col gap-5"
          onSubmit={e => {
            e.preventDefault();
            if (!productValid) return;
            void save({ ...productForm, imageUrl: productForm.imageUrl.trim() || null, action: editing ? "updateProduct" : "createProduct", ...(editing ? { id: editing.id, revision: editing.revision } : {}) }, () => {});
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Nomi">{id => <Input id={id} name="name" required maxLength={120} disabled={locked} value={productForm.name} onChange={e => setProductForm(p => ({ ...p, name: e.target.value }))} />}</TextField>
            <TextField label="Kategoriya">
              {id => (
                <div className="flex gap-2">
                  <NativeSelect id={id} name="category" className="w-full min-w-0 flex-1" required disabled={locked} value={productForm.category} onChange={e => setProductForm(p => ({ ...p, category: e.target.value }))}>
                    <NativeSelectOption value="">Tanlang</NativeSelectOption>
                    {categories.map(c => (
                      <NativeSelectOption key={c} value={c}>
                        {c}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={locked}
                    onClick={() => {
                      setNewCategory("");
                      setCategoryOpen(true);
                    }}
                  >
                    <PlusIcon data-icon="inline-start" />
                    Kategoriya
                  </Button>
                </div>
              )}
            </TextField>
            <CatalogImageUpload key={editing?.id ?? "draft"} label="Asosiy rasm" value={productForm.imageUrl} disabled={locked || !data.enabled} onBusy={setUploading} onChange={imageUrl => setProductForm(p => ({ ...p, imageUrl }))} />
            <TextField label="E’lon holati" description={editing ? "E’lon qilish uchun kamida bitta faol variant kerak." : "Yangi mahsulot qoralama sifatida saqlanadi."}>
              {id => (
                <NativeSelect id={id} name="published" className="w-full" disabled={locked || !editing} value={productForm.published ? "published" : "draft"} onChange={e => setProductForm(p => ({ ...p, published: e.target.value === "published" }))}>
                  <NativeSelectOption value="draft">Qoralama</NativeSelectOption>
                  <NativeSelectOption value="published">E’lon qilingan</NativeSelectOption>
                </NativeSelect>
              )}
            </TextField>
          </div>
          <TextField label="Tavsif">{id => <Textarea id={id} name="description" maxLength={3000} rows={4} disabled={locked} value={productForm.description} onChange={e => setProductForm(p => ({ ...p, description: e.target.value }))} />}</TextField>
          <CatalogOptionEditor groups={productForm.optionGroups} disabled={locked || !data.enabled} onBusy={setUploading} onChange={optionGroups => setProductForm(p => ({ ...p, optionGroups }))} />
          {!variantOpen && <InlineError message={error} />}
          <SubmitButton busy={busy && !variantOpen} disabled={!enabled || !productValid} className="self-start">
            Mahsulotni saqlash
          </SubmitButton>
        </form>
      </Section>

      {product && (
        <Section
          title="Variantlar"
          description="Yangi variant qoldig‘i nol bo‘ladi. Qoldiq «Ombor» bo‘limidagi kirim orqali oshadi."
          action={
            <Button type="button" variant="outline" disabled={locked || !data.enabled} onClick={() => openVariant(null)}>
              <PlusIcon data-icon="inline-start" />
              Variant
            </Button>
          }
        >
          {variants.length ? (
            <TableFrame>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Xususiyatlar</TableHead>
                    <TableHead className="text-right">Narx</TableHead>
                    <TableHead className="text-right">Qoldiq</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead className="text-right">Amal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variants.map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono">{v.sku}</TableCell>
                      <TableCell>{describe(v)}</TableCell>
                      <TableCell className="text-right">
                        <Money value={v.price_uzs} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{v.quantity}</TableCell>
                      <TableCell>
                        <StatusBadge tone={v.active ? "success" : "neutral"}>{v.active ? "Faol" : "Faol emas"}</StatusBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant="secondary" disabled={locked} onClick={() => openVariant(v)}>
                          <PencilIcon data-icon="inline-start" />
                          Tahrirlash
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableFrame>
          ) : (
            <EmptyState title="Variantlar yo‘q" description="Sotuvga chiqarish uchun kamida bitta faol variant qo‘shing." />
          )}
        </Section>
      )}

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yangi kategoriya</DialogTitle>
            <DialogDescription>Kategoriya mahsulot saqlanganda katalogga qo‘shiladi.</DialogDescription>
          </DialogHeader>
          <form
            id="category-form"
            onSubmit={e => {
              e.preventDefault();
              e.stopPropagation();
              addCategory();
            }}
          >
            <TextField label="Kategoriya nomi" description={categoryExists ? "Bunday kategoriya bor, u tanlanadi." : undefined}>
              {id => <Input id={id} name="newCategory" required maxLength={80} autoFocus value={newCategory} placeholder="Masalan: Telefonlar" onChange={e => setNewCategory(e.target.value)} />}
            </TextField>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCategoryOpen(false)}>
              Ortga
            </Button>
            <Button type="submit" form="category-form" disabled={!categoryName}>
              {categoryExists ? "Tanlash" : "Qo‘shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={variantOpen && !!product} onOpenChange={next => !next && !locked && setVariantOpen(false)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto overscroll-contain sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{variantEditing ? "Variantni tahrirlash" : "Yangi variant"}</DialogTitle>
            <DialogDescription>{product?.name}</DialogDescription>
          </DialogHeader>
          {product && (
            <form
              id="variant-form"
              className="grid gap-4"
              onSubmit={e => {
                e.preventDefault();
                if (!variantValid) return;
                void save(
                  {
                    ...variantForm,
                    imageUrl: variantForm.imageUrl.trim() || null,
                    color: product.option_groups.length ? (variantForm.optionValues["Rang"] ?? "—") : variantForm.color,
                    storage: product.option_groups.length ? (variantForm.optionValues["Xotira"] ?? "") : variantForm.storage,
                    action: variantEditing ? "updateVariant" : "createVariant",
                    ...(variantEditing ? { id: variantEditing.id, revision: variantEditing.revision } : { productId: product.id }),
                  },
                  () => {
                    setVariantOpen(false);
                    setVariantEditing(null);
                    setVariantForm(emptyVariant);
                  }
                );
              }}
            >
              <TextField label="SKU">{id => <Input id={id} name="sku" required maxLength={80} disabled={locked} value={variantForm.sku} onChange={e => setVariantForm(p => ({ ...p, sku: e.target.value }))} />}</TextField>
              {product.option_groups.length ? (
                product.option_groups.map(g => (
                  <TextField key={g.name} label={g.name} description={variantEditing ? "Saqlangan variantning xususiyati o‘zgarmaydi." : g.affectsPrice ? "Bu xususiyat narxga ta’sir qilishi mumkin." : undefined}>
                    {id => (
                      <NativeSelect id={id} name={"option-" + g.name} className="w-full" required disabled={locked || !!variantEditing} value={variantForm.optionValues[g.name] ?? ""} onChange={e => setVariantForm(p => ({ ...p, optionValues: { ...p.optionValues, [g.name]: e.target.value } }))}>
                        <NativeSelectOption value="">Tanlang</NativeSelectOption>
                        {g.values.map(v => (
                          <NativeSelectOption key={v.label} value={v.label}>
                            {v.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    )}
                  </TextField>
                ))
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Rang">{id => <Input id={id} name="color" required maxLength={80} disabled={locked} value={variantForm.color} onChange={e => setVariantForm(p => ({ ...p, color: e.target.value }))} />}</TextField>
                  <TextField label="Xotira (ixtiyoriy)">{id => <Input id={id} name="storage" maxLength={80} disabled={locked} value={variantForm.storage} onChange={e => setVariantForm(p => ({ ...p, storage: e.target.value }))} />}</TextField>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Sotuv narxi">{id => <MoneyInput id={id} name="price" disabled={locked} value={variantForm.price} onChange={price => setVariantForm(p => ({ ...p, price }))} />}</TextField>
                <TextField label="Holat">
                  {id => (
                    <NativeSelect id={id} name="active" className="w-full" disabled={locked} value={variantForm.active ? "active" : "inactive"} onChange={e => setVariantForm(p => ({ ...p, active: e.target.value === "active" }))}>
                      <NativeSelectOption value="active">Faol</NativeSelectOption>
                      <NativeSelectOption value="inactive">Faol emas</NativeSelectOption>
                    </NativeSelect>
                  )}
                </TextField>
              </div>
              <CatalogImageUpload key={variantEditing?.id ?? "new-variant"} label="Variantning alohida rasmi (ixtiyoriy)" value={variantForm.imageUrl} disabled={locked || !data.enabled} onBusy={setUploading} onChange={imageUrl => setVariantForm(p => ({ ...p, imageUrl }))} />
              <InlineError message={error} />
            </form>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={locked} onClick={() => setVariantOpen(false)}>
              Ortga
            </Button>
            <SubmitButton form="variant-form" busy={busy} disabled={!enabled || !variantValid}>
              Variantni saqlash
            </SubmitButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
