import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Do‘kon — savdo platformasi",
  description: "Mahsulotlar va buyurtmalarni boshqarish platformasi",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="uz" className={cn("font-sans", geist.variable)}><body>{children}</body></html>;
}
