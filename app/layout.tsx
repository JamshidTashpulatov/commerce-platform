import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { STORE_DESCRIPTION, STORE_NAME, TITLE_TEMPLATE } from "@/lib/storefront";
import { siteOrigin } from "@/lib/server/site";

// SortUI is set in Inter.
const inter = Inter({subsets:['latin','latin-ext'],variable:'--font-sans'});

// Shared by the storefront and the back office. Icons come from app/favicon.ico,
// app/icon.svg and app/apple-icon.png; the manifest from app/manifest.ts.
export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(siteOrigin()),
    applicationName: STORE_NAME,
    title: { default: STORE_NAME, template: TITLE_TEMPLATE },
    description: STORE_DESCRIPTION,
    openGraph: { siteName: STORE_NAME, locale: "uz_UZ", type: "website" },
    twitter: { card: "summary_large_image" },
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export const viewport: Viewport = { themeColor: "#ffffff", colorScheme: "light", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="uz" className={cn("font-sans", inter.variable)}><body>{children}</body></html>;
}
