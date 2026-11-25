import type { Metadata } from "next";
import type { ReactNode } from "react";
import { privateMetadata } from "@/lib/private-meta";

/** The title carries only the short order reference that is already in the URL. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return privateMetadata(/^[0-9a-f]{8}-/i.test(id) ? "Buyurtma " + id.slice(0, 8).toLowerCase() : "Buyurtma", undefined, "/staff/opengraph-image");
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
