"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingBlock, RefreshButton, Section, errorText, tashkentToday } from "./kit";
import { ReviewList, type ReceiptReview } from "./reviews";
import { staffFetch } from "@/lib/staff-client";

/**
 * Discrepancies of one order. There is no per-order endpoint, so this reads the cashbook report
 * (administrator only), which always includes every open discrepancy, and filters by order.
 * norman: closed discrepancies older than this month are not shown here, add when the API returns reviews per order.
 */
export function OrderReviews({ orderId, version }: { orderId: string; version: number }) {
  const [reviews, setReviews] = useState<ReceiptReview[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const today = tashkentToday();
      const d = await staffFetch<{ reviews: ReceiptReview[] }>("/api/admin/cashbook?" + new URLSearchParams({ from: today.slice(0, 7) + "-01", to: today }));
      setReviews(d.reviews.filter(r => r.order_id === orderId));
    } catch (e) {
      setReviews(null);
      setError(errorText(e, "Tafovutlar yuklanmadi"));
    } finally {
      setLoading(false);
    }
  }, [orderId]);
  useEffect(() => {
    void load();
  }, [load, version]);

  return (
    <Section title="Tafovutlar" description="Bekor qilib bo‘lmaydigan xato to‘lov qaydlari bo‘yicha tekshiruvlar. Ochiq tafovutlar va shu oyda yopilganlari ko‘rsatiladi." action={<RefreshButton busy={loading} onClick={() => void load()} />}>
      {loading ? <LoadingBlock rows={2} label="Tafovutlar yuklanmoqda" /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : reviews?.length ? <ReviewList reviews={reviews} onResolved={() => void load()} /> : <EmptyState title="Bu buyurtmada ochiq tafovut yo‘q" description="Xato to‘lov qaydini bekor qilib bo‘lmasa, to‘lovlar tarixidagi «Tuzatish» orqali tafovut oching." />}
    </Section>
  );
}
