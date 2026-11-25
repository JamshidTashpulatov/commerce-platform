"use client";

import { createContext, useContext, useId, type ReactNode } from "react";
import { AlertCircleIcon, InboxIcon, RefreshCwIcon } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { CURRENCY, MONEY_MAX_DIGITS, formatMoney, groupMoneyDigits } from "@/lib/money";
import { cn } from "@/lib/utils";

export type StaffRole = "owner" | "admin" | "seller";
const RoleContext = createContext<StaffRole>("seller");
export function RoleProvider({ role, children }: { role: StaffRole; children: ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}
export const useStaffRole = () => useContext(RoleContext);
export const isAdminRole = (role: StaffRole) => role === "owner" || role === "admin";
export const roleLabels: Record<StaffRole, string> = { owner: "Egasi", admin: "Administrator", seller: "Sotuvchi" };

/** Today's date in Tashkent as YYYY-MM-DD, the format every API date field expects. */
export function tashkentToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return ["year", "month", "day"].map(k => parts.find(p => p.type === k)?.value).join("-");
}
export function formatDay(value: string | null | undefined) {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : value;
}
/** Timestamp shown as a Tashkent calendar day, DD.MM.YYYY. */
export function formatStamp(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const pick = (k: string) => parts.find(p => p.type === k)?.value;
  return `${pick("day")}.${pick("month")}.${pick("year")}`;
}
/** An amount as the store shows it: whole US dollars, "$1,250". One formatter for the whole project. */
export const formatSum = (value: string | bigint) => formatMoney(value);
/** A positive whole-dollar amount the money inputs can hold (up to $999,999,999). */
export const isAmount = (value: string) => new RegExp(`^[1-9][0-9]{0,${MONEY_MAX_DIGITS - 1}}$`).test(value);
export const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="font-heading text-xl font-semibold tracking-tight text-balance">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-pretty text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function RefreshButton({ onClick, busy, label = "Yangilash" }: { onClick: () => void; busy?: boolean; label?: string }) {
  return (
    <Button type="button" variant="outline" onClick={onClick} disabled={busy}>
      <RefreshCwIcon data-icon="inline-start" className={cn(busy && "animate-spin")} />
      {label}
    </Button>
  );
}

/**
 * A page section: heading, optional description and action, then content directly on the page.
 * Deliberately not a card, so tables, stat tiles and sub-forms inside are the only framed level.
 */
export function Section({ title, description, action, children, className, plain }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string; plain?: boolean }) {
  // `plain`: the caller (a step of the order flow) already shows the title and explanation.
  if (plain)
    return (
      <section aria-label={title} className={cn("flex flex-col gap-4", className)}>
        {action && <div className="flex justify-end">{action}</div>}
        {children}
      </section>
    );
  return (
    <section className={cn("flex flex-col gap-4 border-t pt-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="font-heading text-base font-medium">{title}</h2>
          {description && <p className="mt-1 max-w-2xl text-sm text-pretty text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</dl>;
}
export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "default" | "danger" | "muted" }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card px-3 py-2.5">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-base font-semibold tabular-nums", tone === "danger" && "text-destructive", tone === "muted" && "text-muted-foreground")}>{value}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

export function Money({ value, className }: { value: string | bigint | null | undefined; className?: string }) {
  return <span className={cn("tabular-nums whitespace-nowrap", className)}>{value === null || value === undefined ? "—" : formatSum(value)}</span>;
}

export function LoadingBlock({ rows = 3, label = "Yuklanmoqda" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry, title = "Yuklab bo‘lmadi" }: { message: string; onRetry?: () => void; title?: string }) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertCircleIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
      {onRetry && (
        <AlertAction>
          <Button type="button" variant="outline" size="xs" onClick={onRetry}>
            Qayta urinish
          </Button>
        </AlertAction>
      )}
    </Alert>
  );
}

export function InlineError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" role="alert">
      <AlertCircleIcon />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <Alert>
      <AlertCircleIcon />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function EmptyState({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <Empty className="border border-dashed py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {children}
    </Empty>
  );
}

/** shadcn data-table frame: rounded border, horizontal scroll kept inside the frame. */
export function TableFrame({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-lg border [&_[data-slot=table-container]]:overscroll-x-contain">{children}</div>;
}

type Tone = "neutral" | "success" | "warning" | "danger" | "info";
// SortUI's own "Status" badge example: an outline badge with a coloured dot.
const toneDot: Record<Tone, string> = { neutral: "bg-muted-foreground", success: "bg-green-500", warning: "bg-orange-500", danger: "bg-destructive", info: "bg-blue-500" };
export function StatusBadge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <Badge variant="outline">
      <span aria-hidden="true" data-icon="inline-start" className={cn("m-0.5 size-2 rounded-full", toneDot[tone])} />
      {children}
    </Badge>
  );
}

export function TextField({ label, description, error, className, children }: { label: string; description?: ReactNode; error?: string; className?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <Field className={className} data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children(id)}
      {description && <FieldDescription>{description}</FieldDescription>}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}

/** Whole-dollar input. Keeps a plain digit string (what the API expects) and shows "$" and thousands separators. */
export function MoneyInput({ id, value, onChange, disabled, placeholder = "0", name, ...rest }: { id?: string; name?: string; value: string; onChange: (digits: string) => void; disabled?: boolean; placeholder?: string; "aria-label"?: string; "aria-invalid"?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs text-muted-foreground" aria-hidden="true">
        {CURRENCY.symbol}
      </span>
      <Input
        id={id}
        name={name}
        inputMode="numeric"
        autoComplete="off"
        className="pl-6 tabular-nums"
        value={value ? groupMoneyDigits(value) : ""}
        placeholder={placeholder}
        disabled={disabled}
        onChange={e => onChange(e.target.value.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "").slice(0, MONEY_MAX_DIGITS))}
        {...rest}
      />
    </div>
  );
}

export function SubmitButton({ busy, children, ...props }: React.ComponentProps<typeof Button> & { busy?: boolean }) {
  return (
    <Button type="submit" {...props} disabled={props.disabled || busy}>
      {busy && <Spinner data-icon="inline-start" />}
      {children}
    </Button>
  );
}

/** Confirmation before a money-affecting or irreversible action. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, destructive, busy, disabled, onConfirm, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: ReactNode; confirmLabel: string; destructive?: boolean; busy?: boolean; disabled?: boolean; onConfirm: () => void; children?: ReactNode }) {
  return (
    <AlertDialog open={open} onOpenChange={next => !busy && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Ortga</AlertDialogCancel>
          <AlertDialogAction variant={destructive ? "destructive" : "default"} disabled={busy || disabled} onClick={onConfirm}>
            {busy && <Spinner data-icon="inline-start" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function SummaryList({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="col-span-2 grid grid-cols-subgrid">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-right font-medium tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
