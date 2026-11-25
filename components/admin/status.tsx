import { deliveryLabels, requestLabels, saleLabels } from "@/lib/staff-client";
import { StatusBadge } from "./kit";

export function RequestBadge({ status }: { status: string }) {
  return <StatusBadge tone={status === "new" ? "info" : status === "in_progress" ? "warning" : status === "cancelled" ? "danger" : "neutral"}>{requestLabels[status] ?? status}</StatusBadge>;
}
export function SaleBadge({ status }: { status: string }) {
  return <StatusBadge tone={status === "sold" ? "success" : "neutral"}>{saleLabels[status] ?? status}</StatusBadge>;
}
export function DeliveryBadge({ status }: { status: string }) {
  return <StatusBadge tone={status === "delivered" ? "success" : status === "in_transit" ? "warning" : "neutral"}>{deliveryLabels[status] ?? status}</StatusBadge>;
}
export function RecordBadge({ reversed }: { reversed: boolean }) {
  return <StatusBadge tone={reversed ? "danger" : "success"}>{reversed ? "Bekor qilingan" : "Qayd etilgan"}</StatusBadge>;
}
