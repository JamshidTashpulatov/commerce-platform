"use client";

import Link from "next/link";
import { PhoneIcon } from "lucide-react";
import { Section, StatusBadge, formatStamp } from "./kit";
import type { WebsiteRequest } from "./order-progress";
import { RequestBadge, SaleBadge } from "./status";
import { buttonVariants } from "@/components/ui/button";

const channelLabels = { cart: "Savat orqali", one_click: "Bir bosishda xarid" } as const;

/** Who sent a website purchase request, so the seller can call them. Staff only. */
export function OrderWebsite({ request }: { request: WebsiteRequest }) {
  const c = request.checkout;
  if (!c) return null;
  return (
    <Section title="Saytdan kelgan so‘rov" description="Mijoz saytda qoldirgan ma’lumotlar. Unga qo‘ng‘iroq qilib, buyurtmani tasdiqlang.">
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">So‘rov raqami</dt>
          <dd className="font-mono font-medium">{c.reference}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Yuborilgan</dt>
          <dd className="font-medium">
            {formatStamp(c.created_at)} · {channelLabels[c.channel]}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Mijoz</dt>
          <dd className="font-medium">{c.name}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Telefon</dt>
          <dd className="font-medium tabular-nums">{c.phone}</dd>
        </div>
        {c.comment && (
          <div className="sm:col-span-2 lg:col-span-4">
            <dt className="text-muted-foreground">Izoh</dt>
            <dd className="text-pretty whitespace-pre-wrap">{c.comment}</dd>
          </div>
        )}
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        <a href={"tel:" + c.phone} className={buttonVariants({ variant: "outline" })}>
          <PhoneIcon data-icon="inline-start" />
          Qo‘ng‘iroq qilish
        </a>
        {c.telegram_signed_in && <StatusBadge tone="info">Telegram orqali kirgan</StatusBadge>}
      </div>
      {!!request.siblings?.length && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Shu so‘rovdagi boshqa buyurtmalar</h3>
          <ul className="flex flex-col divide-y rounded-lg border">
            {request.siblings.map(s => (
              <li key={s.id}>
                <Link href={"/staff/orders/" + s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm hover:bg-fill-1">
                  <span className="min-w-0">
                    <span className="font-mono font-medium">{s.id.slice(0, 8)}</span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {[s.name, s.storage_label, s.color].filter(Boolean).join(" · ") || "Mahsulot"}
                      {s.quantity ? ` · ${s.quantity} dona` : ""}
                    </span>
                  </span>
                  <span className="flex gap-1.5">
                    <RequestBadge status={s.request_status} />
                    <SaleBadge status={s.sale_status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}
