"use client";

import { useEffect, useState } from "react";
import { CheckIcon, ClockIcon, XIcon } from "lucide-react";
import { Money, Notice, StatusBadge, formatDay } from "./kit";
import type { CustomerRating } from "@/lib/customer-rating";
import { staffFetch } from "@/lib/staff-client";
import { cn } from "@/lib/utils";

export type RatedCustomer = { id: string; name: string; phone_masked: string; has_passport: boolean; rating: CustomerRating };
// One colour per level, always next to the letter and the name, so it reads without colour too.
const levelTone = { "A+": "success", A: "info", B: "neutral", C: "warning", D: "danger" } as const;
export const isRisky = (rating: CustomerRating) => rating.level?.key === "C" || rating.level?.key === "D";

export function RatingBadge({ rating }: { rating: CustomerRating }) {
  if (!rating.level) return <StatusBadge tone="neutral">Yangi mijoz, tarix yo‘q</StatusBadge>;
  return (
    <StatusBadge tone={levelTone[rating.level.key as keyof typeof levelTone] ?? "neutral"}>
      {rating.level.key} · {rating.level.name}
    </StatusBadge>
  );
}

const markLabel = { on_time: "vaqtida", late: "kechikib", overdue: "to‘lanmagan" } as const;
/** The last six instalments as small marks, oldest first. Each has a text alternative. */
export function RecentMarks({ rating }: { rating: CustomerRating }) {
  if (!rating.recent.length) return null;
  return (
    <ul aria-label="Oxirgi to‘lovlar" className="flex gap-1">
      {rating.recent.map(m => (
        <li key={m.due} title={`${formatDay(m.due)}: ${markLabel[m.state]}${m.days ? ", " + m.days + " kun" : ""}`} className={cn("flex size-6 items-center justify-center rounded-md border", m.state === "on_time" ? "text-green-600" : m.state === "late" ? "text-orange-600" : "border-destructive/40 text-destructive")}>
          {m.state === "on_time" ? <CheckIcon aria-hidden="true" className="size-3.5" /> : m.state === "late" ? <ClockIcon aria-hidden="true" className="size-3.5" /> : <XIcon aria-hidden="true" className="size-3.5" />}
          <span className="sr-only">
            {formatDay(m.due)}: {markLabel[m.state]}
            {m.days ? `, ${m.days} kun` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The level with the numbers behind it. A level never appears without its reason. */
export function RatingDetails({ rating, warn }: { rating: CustomerRating; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <RatingBadge rating={rating} />
        {rating.score !== null && <span className="font-medium tabular-nums">{rating.score} ball</span>}
        <RecentMarks rating={rating} />
      </div>
      <p className="text-muted-foreground">{rating.reason}</p>
      {rating.contracts > 0 && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Shartnomalar</dt>
            <dd className="font-medium tabular-nums">
              {rating.contracts} ta, {rating.activeContracts} tasi faol
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Vaqtida to‘langan</dt>
            <dd className="font-medium tabular-nums">{rating.due ? Math.round((rating.onTime / rating.due) * 100) + "%" : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Qolgan qarz</dt>
            <dd className="font-medium">
              <Money value={rating.remainingDebt} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Kechikish</dt>
            <dd className="font-medium tabular-nums">{rating.due ? `o‘rtacha ${String(rating.averageDelayDays).replace(".", ",")} kun, eng ko‘pi ${rating.worstDelayDays} kun` : "—"}</dd>
          </div>
        </dl>
      )}
      {warn && isRisky(rating) && <Notice>Bu mijozning to‘lov tarixi xavfli. Qaror sizda: tizim sotuvni to‘xtatmaydi, faqat ogohlantiradi.</Notice>}
    </div>
  );
}

/** Loads and shows one customer's rating. Shows nothing if it cannot be loaded: the rating is only a hint. */
export function CustomerRatingCard({ customerId, warn }: { customerId: string; warn?: boolean }) {
  const [rating, setRating] = useState<CustomerRating | null>(null);
  useEffect(() => {
    let live = true;
    setRating(null);
    staffFetch<{ customer: RatedCustomer }>("/api/admin/customers/ratings?id=" + encodeURIComponent(customerId))
      .then(d => live && setRating(d.customer.rating))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [customerId]);
  if (!rating) return null;
  return (
    <div className="rounded-lg border p-3">
      <RatingDetails rating={rating} warn={warn} />
    </div>
  );
}
