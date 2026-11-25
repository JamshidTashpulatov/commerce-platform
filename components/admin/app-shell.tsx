"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BanknoteIcon,
  BoxesIcon,
  ChevronsUpDownIcon,
  HandCoinsIcon,
  ImageIcon,
  KeyRoundIcon,
  LandmarkIcon,
  LogOutIcon,
  PackageIcon,
  PlusCircleIcon,
  SettingsIcon,
  ShoppingBagIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { brandName } from "@/lib/brand";
import { staffFetch } from "@/lib/staff-client";
import { UzbekValidation } from "./uzbek-validation";
import { BrandMark } from "@/components/brand-mark";
import { RoleProvider, isAdminRole, roleLabels, type StaffRole } from "./kit";

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; match?: string[] };
type NavGroup = { label: string; adminOnly?: boolean; items: NavItem[] };

const groups: NavGroup[] = [
  {
    label: "Buyurtmalar",
    items: [
      { href: "/staff", label: "Buyurtmalar", icon: ShoppingBagIcon, exact: true, match: ["/staff/orders"] },
      { href: "/staff/new", label: "Yangi buyurtma", icon: PlusCircleIcon },
    ],
  },
  {
    label: "Katalog va ombor",
    adminOnly: true,
    items: [
      { href: "/staff/catalog", label: "Mahsulotlar", icon: PackageIcon },
      { href: "/staff/banner", label: "Bosh sahifa banneri", icon: ImageIcon },
      { href: "/staff/inventory", label: "Ombor", icon: BoxesIcon },
    ],
  },
  { label: "Investorlar", adminOnly: true, items: [{ href: "/staff/investors", label: "Investorlar", icon: HandCoinsIcon }] },
  {
    label: "Moliya",
    adminOnly: true,
    items: [
      { href: "/staff/finance", label: "Fond hisoboti", icon: LandmarkIcon },
      { href: "/staff/cashbook", label: "Kassa", icon: BanknoteIcon },
    ],
  },
  { label: "Tizim", adminOnly: true, items: [{ href: "/staff/settings", label: "Sozlamalar", icon: SettingsIcon }] },
];

function isActive(pathname: string, item: NavItem) {
  if (pathname === item.href) return true;
  if (!item.exact && pathname.startsWith(item.href + "/")) return true;
  return !!item.match?.some(prefix => pathname.startsWith(prefix));
}

function Navigation({ role }: { role: StaffRole }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const visible = groups.filter(g => !g.adminOnly || isAdminRole(role));
  return (
    <>
      {visible.map(group => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map(item => {
                const active = isActive(pathname, item);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton isActive={active} tooltip={item.label} render={<Link href={item.href} aria-current={active ? "page" : undefined} onClick={() => setOpenMobile(false)} />}>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

function AccountMenu({ role }: { role: StaffRole }) {
  const { isMobile } = useSidebar();
  const [busy, setBusy] = useState(false);
  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await staffFetch("/api/auth/logout", "POST", {});
      window.location.replace("/login");
    } catch {
      toast.error("Hisobdan chiqib bo‘lmadi. Qayta urinib ko‘ring.");
      setBusy(false);
    }
  }
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" aria-label="Hisob menyusi" />}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <UserRoundIcon className="size-4" />
            </span>
            <span className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{roleLabels[role]}</span>
              <span className="truncate text-xs text-muted-foreground">{isAdminRole(role) ? "Email va parol orqali" : "Telegram orqali"}</span>
            </span>
            <ChevronsUpDownIcon className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side={isMobile ? "top" : "right"} align="end" className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{roleLabels[role]}</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {isAdminRole(role) && (
                <DropdownMenuItem render={<Link href="/admin/password" />}>
                  <KeyRoundIcon />
                  Parolni o‘zgartirish
                </DropdownMenuItem>
              )}
              <DropdownMenuItem disabled={busy} onClick={() => void logout()}>
                <LogOutIcon />
                Hisobdan chiqish
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function currentTitle(pathname: string) {
  if (pathname.startsWith("/staff/orders/")) return "Buyurtma";
  if (pathname.startsWith("/staff/investors/")) return "Investor";
  for (const group of groups) for (const item of group.items) if (pathname === item.href) return item.label;
  return "Ish maydoni";
}

export function AppShell({ role, children }: { role: StaffRole; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <RoleProvider role={role}>
      <TooltipProvider>
        <SidebarProvider data-ui="shadcn" data-ui-size="m">
          <Sidebar collapsible="icon">
            <SidebarHeader>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton size="lg" render={<Link href="/staff" />}>
                    <span className="flex size-8 shrink-0 items-center justify-center">
                      <BrandMark className="size-7" />
                    </span>
                    <span className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{brandName}</span>
                      <span className="truncate text-xs text-muted-foreground">Ish maydoni</span>
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
              <Navigation role={role} />
            </SidebarContent>
            <SidebarFooter>
              <AccountMenu role={role} />
            </SidebarFooter>
            <SidebarRail />
          </Sidebar>
          <SidebarInset className="min-w-0 bg-card">
            <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-card px-3 sm:px-4">
              <SidebarTrigger aria-label="Menyuni ochish yoki yopish" />
              <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center" />
              <p className="truncate text-sm font-medium">{currentTitle(pathname)}</p>
            </header>
            <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-1 flex-col gap-6 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6">{children}</main>
          </SidebarInset>
          <UzbekValidation />
          <Toaster theme="light" position="top-center" />
        </SidebarProvider>
      </TooltipProvider>
    </RoleProvider>
  );
}
