"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { CatalogImageUpload } from "./catalog-image-upload";
import { EmptyState, TextField } from "./kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { OptionGroup } from "@/lib/catalog-options";

export function CatalogOptionEditor({ groups, onChange, disabled, onBusy }: { groups: OptionGroup[]; onChange: (groups: OptionGroup[]) => void; disabled: boolean; onBusy: (busy: boolean) => void }) {
  function patch(index: number, group: Partial<OptionGroup>) {
    onChange(groups.map((g, i) => (i === index ? { ...g, ...group } : g)));
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">Xususiyatlar</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Masalan, rang, xotira yoki komplektatsiya. Har bir qiymatga o‘z rasmini biriktirish mumkin. Narx variantlarda belgilanadi.</p>
        </div>
        <Button type="button" variant="outline" disabled={disabled || groups.length >= 8} onClick={() => onChange([...groups, { name: "", affectsPrice: false, values: [{ label: "", imageUrl: null }] }])}>
          <PlusIcon data-icon="inline-start" />
          Xususiyat
        </Button>
      </div>
      {!groups.length && <EmptyState title="Xususiyatlar yo‘q" description="Xususiyat qo‘shilmasa, variantlarda rang va xotira qo‘lda yoziladi." />}
      {groups.map((g, i) => (
        <fieldset key={i} className="flex flex-col gap-4 rounded-lg border p-3">
          <legend className="sr-only">{g.name || `${i + 1}-xususiyat`}</legend>
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <TextField label="Xususiyat nomi">{id => <Input id={id} name={`group-${i}-name`} required maxLength={60} value={g.name} disabled={disabled} placeholder="Rang" onChange={e => patch(i, { name: e.target.value })} />}</TextField>
            <TextField label="Narxga ta’sir">
              {id => (
                <NativeSelect id={id} name={`group-${i}-price`} className="w-full" value={g.affectsPrice ? "yes" : "no"} disabled={disabled} onChange={e => patch(i, { affectsPrice: e.target.value === "yes" })}>
                  <NativeSelectOption value="no">Ta’sir qilmaydi</NativeSelectOption>
                  <NativeSelectOption value="yes">Ta’sir qilishi mumkin</NativeSelectOption>
                </NativeSelect>
              )}
            </TextField>
            <Button type="button" variant="ghost" disabled={disabled} onClick={() => onChange(groups.filter((_, k) => k !== i))}>
              <Trash2Icon data-icon="inline-start" />
              Xususiyatni olib tashlash
            </Button>
          </div>
          <ul className="flex flex-col gap-3">
            {g.values.map((v, j) => (
              <li key={j} className="grid gap-4 rounded-lg bg-muted/50 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
                <TextField label="Qiymat">{id => <Input id={id} name={`group-${i}-value-${j}`} required maxLength={80} disabled={disabled} value={v.label} placeholder="Qora" onChange={e => patch(i, { values: g.values.map((a, k) => (k === j ? { ...a, label: e.target.value } : a)) })} />}</TextField>
                <CatalogImageUpload label="Qiymat rasmi (ixtiyoriy)" value={v.imageUrl ?? ""} disabled={disabled} onBusy={onBusy} onChange={imageUrl => patch(i, { values: g.values.map((a, k) => (k === j ? { ...a, imageUrl: imageUrl || null } : a)) })} />
                <Button type="button" variant="ghost" size="icon" className="sm:mt-6" aria-label={`${v.label || j + 1 + "-qiymat"}ni olib tashlash`} disabled={disabled || g.values.length <= 1} onClick={() => patch(i, { values: g.values.filter((_, k) => k !== j) })}>
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" className="self-start" disabled={disabled || g.values.length >= 30} onClick={() => patch(i, { values: [...g.values, { label: "", imageUrl: null }] })}>
            <PlusIcon data-icon="inline-start" />
            Qiymat
          </Button>
        </fieldset>
      ))}
    </div>
  );
}
