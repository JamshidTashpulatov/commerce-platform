"use client";

import { useCallback, useEffect, useState } from "react";
import { SearchIcon } from "lucide-react";
import { EmptyState, ErrorState, LoadingBlock, Money, Notice, PageHeader, RefreshButton, TableFrame, TextField, errorText } from "@/components/admin/kit";
import { RatingBadge, RatingDetails, RecentMarks, type RatedCustomer } from "@/components/admin/customer-rating";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RATING } from "@/lib/customer-rating";
import { staffFetch } from "@/lib/staff-client";

type Data = { customers: RatedCustomer[]; truncated: boolean };
const sorts = { overdue: "Muddati o‘tgan qarz bo‘yicha", score: "Ball bo‘yicha (pastdan)", debt: "Qolgan qarz bo‘yicha" } as const;

export default function Customers() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [level, setLevel] = useState("all");
  const [sort, setSort] = useState<keyof typeof sorts>("overdue");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<RatedCustomer | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await staffFetch<Data>("/api/admin/customers/ratings"));
    } catch (e) {
      setData(null);
      setError(errorText(e, "Mijozlar yuklanmadi"));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const big = (v: string) => BigInt(v);
  const rows = (data?.customers ?? [])
    .filter(c => (level === "all" ? true : level === "new" ? !c.rating.level : c.rating.level?.key === level))
    .filter(c => (c.name + " " + c.phone_masked).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "score") return (a.rating.score ?? 101) - (b.rating.score ?? 101);
      const [x, y] = sort === "debt" ? [big(a.rating.remainingDebt), big(b.rating.remainingDebt)] : [big(a.rating.overdueAmount), big(b.rating.overdueAmount)];
      return x === y ? (a.rating.score ?? 101) - (b.rating.score ?? 101) : x > y ? -1 : 1;
    });

  return (
    <>
      <PageHeader title="Mijozlar" description="Reyting nasiya to‘lovlari tarixidan o‘zi hisoblanadi.">
        <RefreshButton busy={loading} onClick={() => void load()} />
      </PageHeader>
      {loading && !data ? (
        <LoadingBlock rows={6} label="Mijozlar yuklanmoqda" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : data ? (
        <>
          {data.truncated && <Notice>Ro‘yxat uzun: oxirgi 1000 ta mijoz ko‘rsatilgan.</Notice>}
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField label="Qidirish">
              {id => (
                <div className="relative">
                  <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id={id} type="search" name="search" placeholder="Ism yoki telefon" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              )}
            </TextField>
            <TextField label="Reyting">
              {id => (
                <NativeSelect id={id} name="level" className="w-full" value={level} onChange={e => setLevel(e.target.value)}>
                  <NativeSelectOption value="all">Barchasi</NativeSelectOption>
                  {RATING.levels.map(l => (
                    <NativeSelectOption key={l.key} value={l.key}>
                      {l.key} · {l.name}
                    </NativeSelectOption>
                  ))}
                  <NativeSelectOption value="new">Yangi mijoz, tarix yo‘q</NativeSelectOption>
                </NativeSelect>
              )}
            </TextField>
            <TextField label="Tartib">
              {id => (
                <NativeSelect id={id} name="sort" className="w-full" value={sort} onChange={e => setSort(e.target.value as keyof typeof sorts)}>
                  {Object.entries(sorts).map(([k, v]) => (
                    <NativeSelectOption key={k} value={k}>
                      {v}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </TextField>
          </div>
          {rows.length ? (
            <TableFrame>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mijoz</TableHead>
                    <TableHead>Reyting</TableHead>
                    <TableHead className="hidden lg:table-cell">Oxirgi to‘lovlar</TableHead>
                    <TableHead className="text-right">Muddati o‘tgan</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Qolgan qarz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="min-w-36 whitespace-normal">
                        <button type="button" className="text-left font-medium underline-offset-4 hover:underline" onClick={() => setOpen(c)}>
                          {c.name}
                        </button>
                        <span className="block whitespace-nowrap text-muted-foreground tabular-nums">{c.phone_masked}</span>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <RatingBadge rating={c.rating} />
                        {(c.rating.level || c.rating.contracts > 0) && (
                          <span className="mt-1 block text-sm text-muted-foreground">
                            {c.rating.score !== null ? c.rating.score + " ball · " : ""}
                            {c.rating.level ? c.rating.reason : "Birinchi to‘lov muddati hali kelmagan."}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <RecentMarks rating={c.rating} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={c.rating.overdueAmount} className={c.rating.overdueAmount !== "0" ? "font-medium text-destructive" : "text-muted-foreground"} />
                      </TableCell>
                      <TableCell className="hidden text-right sm:table-cell">
                        <Money value={c.rating.remainingDebt} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableFrame>
          ) : (
            <EmptyState title={data.customers.length ? "Bu tanlov bo‘yicha mijoz yo‘q" : "Hozircha mijoz yo‘q"} />
          )}
          <Dialog open={!!open} onOpenChange={next => !next && setOpen(null)}>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>{open?.name}</DialogTitle>
                <DialogDescription>
                  {open?.phone_masked} · pasport {open?.has_passport ? "kiritilgan" : "kiritilmagan"}
                </DialogDescription>
              </DialogHeader>
              {open && <RatingDetails rating={open.rating} />}
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </>
  );
}
