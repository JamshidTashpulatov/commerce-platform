"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, SearchIcon } from "lucide-react";
import { EmptyState, ErrorState, LoadingBlock, Money, PageHeader, RefreshButton, Stat, StatGrid, TableFrame, formatStamp } from "@/components/admin/kit";
import { DeliveryBadge, RequestBadge, SaleBadge } from "@/components/admin/status";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requestLabels, sourceLabels, staffFetch, type StaffOrder } from "@/lib/staff-client";

export default function StaffInbox() {
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [pages, setPages] = useState<string[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const cursor = pages[pages.length - 1];

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setNext(null);
    const params = new URLSearchParams({ q: query.trim(), status });
    if (cursor) params.set("after", cursor);
    const timer = setTimeout(
      async () => {
        try {
          const data = await staffFetch<{ items: StaffOrder[]; next: string | null }>("/api/admin/orders?" + params);
          if (active) {
            setOrders(data.items);
            setNext(data.next);
          }
        } catch (e) {
          if (active) {
            setOrders([]);
            setError(e instanceof Error ? e.message : "Buyurtmalarni yuklab bo‘lmadi");
          }
        } finally {
          if (active) setLoading(false);
        }
      },
      query ? 200 : 0
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, status, cursor, revision]);

  const filtered = !!query.trim() || !!status;
  return (
    <>
      <PageHeader title="Buyurtmalar" description="Sayt va sotuvchilardan kelgan buyurtmalar. Bir sahifada 100 tagacha buyurtma ko‘rsatiladi.">
        <RefreshButton busy={loading} onClick={() => setRevision(r => r + 1)} />
        <Link href="/staff/new" className={buttonVariants({ size: "sm" })}>
          <PlusIcon data-icon="inline-start" />
          Buyurtma yaratish
        </Link>
      </PageHeader>

      <StatGrid className="grid-cols-3 sm:grid-cols-3 xl:grid-cols-3">
        <Stat label="Sahifada" value={orders.length} />
        <Stat label="Yangi" value={orders.filter(o => o.request_status === "new").length} />
        <Stat label="Sotilgan" value={orders.filter(o => o.sale_status === "sold").length} />
      </StatGrid>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={status || "all"}
          onValueChange={value => {
            setPages([]);
            setStatus(value === "all" ? "" : String(value));
          }}
          className="max-w-full overflow-x-auto"
        >
          <TabsList aria-label="Buyurtma holati bo‘yicha filtr">
            <TabsTrigger value="all">Barchasi</TabsTrigger>
            {Object.entries(requestLabels).map(([key, label]) => (
              <TabsTrigger key={key} value={key}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full lg:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            name="q"
            aria-label="Buyurtma raqami bo‘yicha qidirish"
            placeholder="Buyurtma raqami"
            className="pl-8"
            value={query}
            maxLength={36}
            onChange={e => {
              setPages([]);
              setQuery(e.target.value.toLowerCase().replace(/[^0-9a-f-]/g, ""));
            }}
          />
        </div>
      </div>

      {loading ? (
        <LoadingBlock rows={6} label="Buyurtmalar yuklanmoqda" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setRevision(r => r + 1)} />
      ) : !orders.length ? (
        <EmptyState title={filtered ? "Buyurtma topilmadi" : "Hozircha buyurtma yo‘q"} description={filtered ? "Qidiruv yoki filtrni o‘zgartirib ko‘ring." : "Birinchi buyurtmani o‘zingiz yarating yoki saytdan so‘rov kelishini kuting."} />
      ) : (
        <>
          <ul className="flex flex-col divide-y rounded-lg border md:hidden">
            {orders.map(o => (
              <li key={o.id}>
                <Link href={"/staff/orders/" + o.id} className="flex flex-col gap-2 px-3 py-3 active:bg-muted" aria-label={"Buyurtma " + o.id}>
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-sm font-medium">{o.id.slice(0, 8)}</span>
                    <Money value={o.total_uzs ?? "0"} className="text-sm font-medium" />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatStamp(o.created_at)} · {sourceLabels[o.source]}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    <RequestBadge status={o.request_status} />
                    <SaleBadge status={o.sale_status} />
                    <DeliveryBadge status={o.fulfillment_status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <TableFrame>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Raqam</TableHead>
                    <TableHead>Sana</TableHead>
                    <TableHead>Manba</TableHead>
                    <TableHead className="text-right">So‘rov qiymati</TableHead>
                    <TableHead>Buyurtma</TableHead>
                    <TableHead>Sotuv</TableHead>
                    <TableHead>Yetkazish</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map(o => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link href={"/staff/orders/" + o.id} className="font-mono font-medium underline-offset-4 hover:underline" aria-label={"Buyurtma " + o.id}>
                          {o.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell>{formatStamp(o.created_at)}</TableCell>
                      <TableCell>{sourceLabels[o.source]}</TableCell>
                      <TableCell className="text-right">
                        <Money value={o.total_uzs ?? "0"} />
                      </TableCell>
                      <TableCell>
                        <RequestBadge status={o.request_status} />
                      </TableCell>
                      <TableCell>
                        <SaleBadge status={o.sale_status} />
                      </TableCell>
                      <TableCell>
                        <DeliveryBadge status={o.fulfillment_status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableFrame>
          </div>
        </>
      )}

      {(pages.length > 0 || next) && (
        <nav aria-label="Buyurtma sahifalari" className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{pages.length + 1}-sahifa</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={loading || pages.length === 0} onClick={() => setPages(p => p.slice(0, -1))}>
              <ChevronLeftIcon data-icon="inline-start" />
              Oldingi
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={loading || !next} onClick={() => next && setPages(p => [...p, next])}>
              Keyingi
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </nav>
      )}
    </>
  );
}
