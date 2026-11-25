import type { ReactNode } from "react";
import { privateMetadata } from "@/lib/private-meta";

export const metadata = privateMetadata("Ombor", undefined, "/staff/opengraph-image");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
