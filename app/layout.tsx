import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

// SortUI is set in Inter.
const inter = Inter({subsets:['latin','latin-ext'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Do‘kon — savdo platformasi",
  description: "Mahsulotlar va buyurtmalarni boshqarish platformasi",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="uz" className={cn("font-sans", inter.variable)}><body>{children}</body></html>;
}
