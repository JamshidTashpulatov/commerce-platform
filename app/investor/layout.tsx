import type { ReactNode } from "react";
import { privateMetadata } from "@/lib/private-meta";

export const metadata = privateMetadata("Investor kabineti");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
