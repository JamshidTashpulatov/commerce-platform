"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, EmptyState, ErrorState, InlineError, LoadingBlock, Money, MoneyInput, Notice, PageHeader, RefreshButton, Section, StatusBadge, SubmitButton, SummaryList, TableFrame, TextField, errorText, isAmount } from "@/components/admin/kit";
import { CapitalCaveat } from "@/components/admin/capital-caveat";
import { PeerPortfolioSetting } from "@/components/admin/peer-portfolio-setting";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { staffFetch } from "@/lib/staff-client";

type Investor = { account_id: string; name: string; contributed: string; withdrawn: string; distributed: string; allocated: string; returned: string; outstanding: string; available: string; phone_masked: string | null; sign_in: "linked" | "pending" | "none"; by_phone: boolean };
const formatLocalPhone = (d: string) => [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" ");
const signInLabels = { linked: "Telegram ulangan", pending: "Tasdiq kutilmoqda", none: "Ulanmagan" } as const;
const signInTone = { linked: "success", pending: "warning", none: "neutral" } as const;
const labels: Record<string, string> = { contribution: "Kapital kiritilishi", withdrawal: "Kapital qaytarilishi", distribution: "Foyda taqsimoti qaydi" };

export default function Investors() {
  const [data, setData] = useState<{ items: Investor[]; enabled: boolean } | null>(null);
  const [id, setId] = useState("");
  const [type, setType] = useState("contribution");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [createError, setCreateError] = useState("");
  const key = useRef("");
  const pending = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setData(await staffFetch<{ items: Investor[]; enabled: boolean }>("/api/admin/investors"));
    } catch (e) {
      setData(null);
      setLoadError(errorText(e, "Yuklab bo‘lmadi"));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const selected = data?.items.find(i => i.account_id === id);
  const overAvailable = !!selected && type === "withdrawal" && isAmount(amount) && BigInt(amount) > BigInt(selected.available);
  const valid = !!selected && isAmount(amount) && (type !== "withdrawal" || BigInt(amount) <= BigInt(selected.available)) && !!data?.enabled && !loading && !busy;

  async function post() {
    if (!valid || pending.current || !confirm) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      key.current ||= crypto.randomUUID();
      await staffFetch("/api/admin/investors", "POST", { accountId: id, type, amount, key: key.current });
      setAmount("");
      setConfirm(false);
      key.current = "";
      await load();
      toast.success("Kapital qaydi saqlandi.");
    } catch (e) {
      setConfirm(false);
      setError(errorText(e, "Saqlash imkoni bo‘lmadi"));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function createAccount() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setCreateError("");
    try {
      await staffFetch("/api/admin/investors/accounts", "POST", { name, phone: "+998" + phoneDigits });
      setName("");
      setPhone("");
      setCreateOpen(false);
      toast.success("Investor hisobi yaratildi.");
      await load();
    } catch (e) {
      setCreateError(errorText(e, "Hisob yaratilmadi"));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  // Nine digits after +998; a pasted full number with the country code is accepted too.
  const phoneDigits = phone.replace(/[^0-9]/g, "").replace(/^998(?=\d{9})/, "").slice(0, 9);
  const touch = () => {
    key.current = "";
  };

  return (
    <>
      <PageHeader title="Investorlar" description="Investor hisoblari va kapital qaydlari. Tizimdan tashqarida bajarilgan operatsiyalar hisobga olinadi, pul o‘tkazilmaydi.">
        <RefreshButton busy={loading || busy} onClick={() => void load()} />
        <Button
          type="button"
         
          onClick={() => {
            setCreateError("");
            setCreateOpen(true);
          }}
        >
          <PlusIcon data-icon="inline-start" />
          Investor qo‘shish
        </Button>
      </PageHeader>
      {loading && !data ? (
        <LoadingBlock rows={6} label="Investorlar yuklanmoqda" />
      ) : !data ? (
        <ErrorState message={loadError || "Yuklab bo‘lmadi"} onRetry={() => void load()} />
      ) : (
        <>
          <Section title="Kapital hisoboti" description="Investor sahifasini ochish uchun nomini bosing. Kapital va foyda qaytimlarini tizim o‘zi hisoblaydi.">
            <CapitalCaveat />
            {data.items.length ? (
              <TableFrame>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Investor</TableHead>
                      <TableHead>Telefon</TableHead>
                      <TableHead>Kirish</TableHead>
                      <TableHead className="text-right">Joriy asosiy kapital</TableHead>
                      <TableHead className="text-right">Kiritilgan</TableHead>
                      <TableHead className="text-right">Yechilgan</TableHead>
                      <TableHead className="text-right">Ajratilgan (yalpi)</TableHead>
                      <TableHead className="text-right">Qaytgan</TableHead>
                      <TableHead className="text-right">Aylanmada</TableHead>
                      <TableHead className="text-right">Bo‘sh kapital</TableHead>
                      <TableHead className="text-right">Foyda qaydi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map(i => (
                      <TableRow key={i.account_id}>
                        <TableCell>
                          <Link href={"/staff/investors/" + i.account_id} className="font-medium underline underline-offset-4" aria-label={i.name + " hisoboti"}>
                            {i.name}
                          </Link>
                        </TableCell>
                        <TableCell className="tabular-nums">{i.phone_masked ?? "—"}</TableCell>
                        <TableCell>
                          <StatusBadge tone={signInTone[i.sign_in]}>{signInLabels[i.sign_in]}</StatusBadge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <Money value={BigInt(i.contributed) - BigInt(i.withdrawn)} />
                        </TableCell>
                        {[i.contributed, i.withdrawn, i.allocated, i.returned, i.outstanding, i.available, i.distributed].map((v, n) => (
                          <TableCell key={n} className="text-right">
                            <Money value={v} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableFrame>
            ) : (
              <EmptyState title="Investor hisoblari hali yo‘q" description="«Investor qo‘shish» orqali birinchi hisobni yarating." />
            )}
          </Section>

          <Section title="Kapital qaydi qo‘shish" description="Kapital qaydlarini faqat administrator kiritadi.">
            {!data.enabled ? (
              <Notice>Modul server sozlamalarida o‘chirilgan.</Notice>
            ) : !data.items.length ? (
              <EmptyState title="Avval investor hisobini yarating" />
            ) : (
              <form
                className="flex flex-col gap-4"
                onSubmit={e => {
                  e.preventDefault();
                  if (valid) setConfirm(true);
                }}
              >
                <div className="grid gap-4 sm:grid-cols-3">
                  <TextField label="Investor">
                    {fieldId => (
                      <NativeSelect
                        id={fieldId}
                        name="accountId"
                        className="w-full"
                        value={id}
                        disabled={busy}
                        onChange={e => {
                          setId(e.target.value);
                          touch();
                        }}
                      >
                        <NativeSelectOption value="">Tanlang</NativeSelectOption>
                        {data.items.map(i => (
                          <NativeSelectOption key={i.account_id} value={i.account_id}>
                            {i.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    )}
                  </TextField>
                  <TextField label="Operatsiya">
                    {fieldId => (
                      <NativeSelect
                        id={fieldId}
                        name="type"
                        className="w-full"
                        value={type}
                        disabled={busy}
                        onChange={e => {
                          setType(e.target.value);
                          touch();
                        }}
                      >
                        {Object.entries(labels).map(([k, v]) => (
                          <NativeSelectOption key={k} value={k}>
                            {v}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    )}
                  </TextField>
                  <TextField
                    label="Summa"
                    description={
                      selected && type === "withdrawal" ? (
                        <>
                          Bo‘sh kapital: <Money value={selected.available} />
                        </>
                      ) : undefined
                    }
                    error={overAvailable ? "Bo‘sh kapitaldan ko‘p yechib bo‘lmaydi." : undefined}
                  >
                    {fieldId => (
                      <MoneyInput
                        id={fieldId}
                        name="amount"
                        value={amount}
                        disabled={busy}
                        aria-invalid={overAvailable || undefined}
                        onChange={value => {
                          setAmount(value);
                          touch();
                        }}
                      />
                    )}
                  </TextField>
                </div>
                <InlineError message={error} />
                <SubmitButton disabled={!valid} className="self-start">
                  Davom etish
                </SubmitButton>
              </form>
            )}
          </Section>

          <PeerPortfolioSetting />

          <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Kapital qaydini saqlaysizmi?" description="Qayd investor portfeli va kassa hisobotida ko‘rinadi." confirmLabel="Qaydni saqlash" busy={busy} disabled={!valid} onConfirm={() => void post()}>
            <SummaryList
              rows={[
                ["Investor", selected?.name ?? "—"],
                ["Operatsiya", labels[type]],
                ["Summa", <Money key="a" value={amount || "0"} />],
              ]}
            />
          </ConfirmDialog>
        </>
      )}

      <Dialog open={createOpen} onOpenChange={next => !busy && setCreateOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Investor hisobini yaratish</DialogTitle>
            <DialogDescription>Investor Telegram mini ilovasi orqali kiradi va faqat ko‘rish huquqiga ega bo‘ladi. Kapital alohida qayd etiladi.</DialogDescription>
          </DialogHeader>
          <form
            id="investor-create"
            className="grid gap-4"
            onSubmit={e => {
              e.preventDefault();
              void createAccount();
            }}
          >
            <TextField label="Investor nomi">{fieldId => <Input id={fieldId} name="name" required minLength={2} maxLength={120} value={name} disabled={busy} onChange={e => setName(e.target.value)} />}</TextField>
            <TextField label="Telefon raqam" description="Investor Telegram mini ilovasiga birinchi kirganda shu raqamni Telegram orqali tasdiqlaydi." error={phoneDigits.length > 0 && phoneDigits.length < 9 ? "9 ta raqam kiriting: operator kodi va nomer." : undefined}>
              {fieldId => (
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs text-muted-foreground" aria-hidden="true">
                    +998
                  </span>
                  <Input id={fieldId} name="phone" type="tel" inputMode="numeric" autoComplete="off" required className="pl-12 tabular-nums" placeholder="90 123 45 67" value={formatLocalPhone(phoneDigits)} disabled={busy} onChange={e => setPhone(e.target.value)} />
                </div>
              )}
            </TextField>
            <InlineError message={createError} />
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setCreateOpen(false)}>
              Ortga
            </Button>
            <SubmitButton form="investor-create" busy={busy} disabled={name.trim().length < 2 || phoneDigits.length !== 9}>
              Hisob yaratish
            </SubmitButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
