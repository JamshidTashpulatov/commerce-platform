import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/admin/app-shell";
import { AuthFrame } from "@/components/admin/auth-frame";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStoreRole } from "@/lib/server/auth";
import { configuredStoreId } from "@/lib/server/db";
import { privateMetadata } from "@/lib/private-meta";

export const dynamic = "force-dynamic";
export const metadata = privateMetadata("Buyurtmalar", "Xodimlar uchun ish maydoni.");

export default async function StaffLayout({ children }: { children: ReactNode }) {
  let role: string | null = null;
  if (process.env.STAFF_WORKSPACE_ENABLED === "true") {
    try {
      role = (await requireStoreRole(configuredStoreId(), ["owner", "admin", "seller"]))?.role ?? null;
    } catch {}
  }
  if (role !== "owner" && role !== "admin" && role !== "seller") {
    return (
      <AuthFrame>
        <Card>
          <CardHeader>
            <CardTitle>
              <h1>Kirish mavjud emas</h1>
            </CardTitle>
            <CardDescription>Ish maydoni faqat vakolatli xodimlar uchun. Sessiya tugagan bo‘lsa, qayta kiring.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login" className={buttonVariants({ className: "w-full" })}>
              Hisobga kirish
            </Link>
          </CardContent>
        </Card>
      </AuthFrame>
    );
  }
  return <AppShell role={role}>{children}</AppShell>;
}
