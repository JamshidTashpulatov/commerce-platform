"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CheckIcon, ChevronDownIcon, LockIcon } from "lucide-react";
import { StatusBadge } from "./kit";
import { cn } from "@/lib/utils";

export type StepStatus = "done" | "current" | "open" | "blocked";
export type OrderStep = {
  id: string;
  title: string;
  /** One sentence: what the step does and what it unlocks. */
  description: string;
  status: StepStatus;
  /** Why a blocked step cannot be done yet. */
  reason?: string;
  /** Short result shown when a finished step is collapsed. */
  summary?: ReactNode;
  content: ReactNode;
};

const statusLabel: Record<StepStatus, string> = { done: "Bajarildi", current: "Hozirgi qadam", open: "Navbatda", blocked: "Bloklangan" };
const statusTone = { done: "success", current: "info", open: "neutral", blocked: "neutral" } as const;

/**
 * The order as a numbered flow. The current step is open and is the one to act on; finished steps
 * collapse to a summary and can be reopened; blocked steps say what has to happen first.
 */
export function OrderSteps({ steps }: { steps: OrderStep[] }) {
  const currentId = steps.find(s => s.status === "current")?.id ?? "";
  const [open, setOpen] = useState(currentId);
  // When an action finishes a step, move on to the next one.
  useEffect(() => setOpen(currentId), [currentId]);

  return (
    <ol className="flex flex-col" aria-label="Buyurtma qadamlari">
      {steps.map((step, index) => {
        const expanded = open === step.id && step.status !== "blocked";
        const last = index === steps.length - 1;
        return (
          <li key={step.id} className="relative flex gap-3 sm:gap-4" aria-current={step.status === "current" ? "step" : undefined}>
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums",
                  step.status === "done" && "bg-primary text-primary-foreground",
                  step.status === "current" && "bg-foreground text-background",
                  (step.status === "open" || step.status === "blocked") && "bg-muted text-muted-foreground"
                )}
                aria-hidden="true"
              >
                {step.status === "done" ? <CheckIcon className="size-4" /> : step.status === "blocked" ? <LockIcon className="size-3.5" /> : index + 1}
              </span>
              {!last && <span className="w-px flex-1 bg-border" aria-hidden="true" />}
            </div>
            <div className={cn("flex min-w-0 flex-1 flex-col gap-3", last ? "pb-1" : "pb-6")}>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-default"
                aria-expanded={expanded}
                disabled={step.status === "blocked"}
                onClick={() => setOpen(expanded ? "" : step.id)}
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn("font-heading text-base font-medium", step.status === "blocked" && "text-muted-foreground")}>
                      {index + 1}. {step.title}
                    </span>
                    <StatusBadge tone={statusTone[step.status]}>{statusLabel[step.status]}</StatusBadge>
                  </span>
                  <span className="text-sm text-pretty text-muted-foreground">{step.status === "blocked" && step.reason ? step.reason : step.description}</span>
                </span>
                {step.status !== "blocked" && <ChevronDownIcon className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} aria-hidden="true" />}
              </button>
              {!expanded && step.status === "done" && step.summary && <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">{step.summary}</div>}
              {expanded && <div className="flex flex-col gap-4">{step.content}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
