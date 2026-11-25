"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ErrorState, InlineError, LoadingBlock, Notice, RefreshButton, Section, StatusBadge, SubmitButton, TextField, errorText } from "./kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { staffFetch } from "@/lib/staff-client";

type Customer = { id: string; name: string; phone_masked: string; has_passport: boolean };

function CustomerCard({ customer }: { customer: Customer }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
      <div>
        <dt className="text-muted-foreground">Mijoz</dt>
        <dd className="font-medium">{customer.name}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Telefon</dt>
        <dd className="font-medium tabular-nums">{customer.phone_masked}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Pasport ma’lumoti</dt>
        <dd>
          <StatusBadge tone={customer.has_passport ? "success" : "warning"}>{customer.has_passport ? "Kiritilgan, himoyalangan" : "Kiritilmagan"}</StatusBadge>
        </dd>
      </div>
    </dl>
  );
}

export function OrderCustomer({ endpoint, cancelled, onLinked }: { endpoint: string; cancelled: boolean; onLinked: () => void }) {
  const url = endpoint + "/customer";
  const [linked, setLinked] = useState<Customer | null>(null);
  const [found, setFound] = useState<Customer | null>(null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [passport, setPassport] = useState("");
  const [stage, setStage] = useState<"find" | "create">("find");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [available, setAvailable] = useState(false);
  const pending = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const d = await staffFetch<{ customer: Customer | null }>(url);
      setLinked(d.customer);
      setAvailable(true);
    } catch (e) {
      setAvailable(false);
      setLoadError(errorText(e, "Mijozni yuklab bo‘lmadi"));
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(errorText(e, "Amal bajarilmadi"));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const find = () =>
    run(async () => {
      const d = await staffFetch<{ customer: Customer | null }>("/api/admin/customers", "POST", { action: "find", phone });
      setFound(d.customer);
      setStage(d.customer ? "find" : "create");
      if (!d.customer) setNotice("Bu raqam bilan mijoz topilmadi. Quyida yangi mijoz yarating.");
    });
  const create = () =>
    run(async () => {
      const d = await staffFetch<{ customer: Customer }>("/api/admin/customers", "POST", { action: "create", phone, name, passport });
      setFound(d.customer);
      setName("");
      setPassport("");
      setPhone("");
      setStage("find");
      setNotice("Mijoz yaratildi. Endi uni buyurtmaga biriktiring.");
    });
  const attach = () =>
    found &&
    run(async () => {
      await staffFetch(url, "PUT", { customerId: found.id });
      setFound(null);
      setPhone("");
      setName("");
      setPassport("");
      toast.success("Mijoz buyurtmaga biriktirildi.");
      await load();
      onLinked();
    });

  return (
    <Section title="Mijoz" action={<RefreshButton busy={loading || busy} onClick={() => void load()} />}>
      {loading ? (
        <LoadingBlock rows={2} label="Mijoz yuklanmoqda" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => void load()} />
      ) : !available ? null : linked ? (
        <CustomerCard customer={linked} />
      ) : cancelled ? (
        <Notice>Buyurtma bekor qilingan. Mijoz biriktirilmaydi.</Notice>
      ) : (
        <>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={e => {
              e.preventDefault();
              void find();
            }}
          >
            <TextField label="Telefon raqami" description="Mavjud mijozni toping yoki yangisini yarating." className="sm:max-w-xs">
              {id => (
                <Input
                  id={id}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={phone}
                  placeholder="+998 90 123 45 67"
                  required
                  maxLength={32}
                  disabled={busy}
                  onChange={e => {
                    setPhone(e.target.value);
                    setFound(null);
                    setStage("find");
                    setName("");
                    setPassport("");
                  }}
                />
              )}
            </TextField>
            <SubmitButton variant="outline" busy={busy && stage === "find" && !found} disabled={!phone.trim()} className="sm:mb-7">
              Mijozni topish
            </SubmitButton>
          </form>
          {notice && <Notice>{notice}</Notice>}
          <InlineError message={error} />
          {found && (
            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <CustomerCard customer={found} />
              <Button type="button" className="self-start" disabled={busy} onClick={() => void attach()}>
                Buyurtmaga biriktirish
              </Button>
            </div>
          )}
          {stage === "create" && !found && (
            <form
              className="flex flex-col gap-4 rounded-lg border p-3"
              onSubmit={e => {
                e.preventDefault();
                void create();
              }}
            >
              <h3 className="text-sm font-medium">Yangi mijoz</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Ism va familiya">{id => <Input id={id} name="name" value={name} autoComplete="off" maxLength={120} required disabled={busy} onChange={e => setName(e.target.value)} />}</TextField>
                <TextField label="Pasport yoki ID raqami (ixtiyoriy)" description="Nasiya uchun kerak. Saqlangach ochiq ko‘rsatilmaydi.">
                  {id => <Input id={id} name="passport" value={passport} autoComplete="off" maxLength={20} disabled={busy} onChange={e => setPassport(e.target.value.toUpperCase())} />}
                </TextField>
              </div>
              <SubmitButton busy={busy} disabled={name.trim().length < 2} className="self-start">
                Mijoz yaratish
              </SubmitButton>
            </form>
          )}
        </>
      )}
    </Section>
  );
}
