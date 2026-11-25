import type { ReactNode } from "react";
import { brandName } from "@/lib/brand";
import { BrandMark } from "./brand-mark";

/** Centered frame shared by the sign-in, activation and password pages (shadcn login block layout). */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div data-ui="shadcn" data-ui-size="m" className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-2 self-center font-medium">
          <BrandMark className="size-7" title={null} />
          {brandName}
        </div>
        {children}
      </div>
    </div>
  );
}
