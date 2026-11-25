import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Do‘kon — savdo platformasi",
  description: "Mahsulotlar va buyurtmalarni boshqarish platformasi",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="uz"><body>{children}</body></html>;
}
