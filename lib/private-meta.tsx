import type { Metadata } from "next";
import { ImageResponse } from "next/og";
import { brandName } from "./brand";
import { TITLE_TEMPLATE } from "./storefront";

export { brandName };
export const ogSize = { width: 1200, height: 630 };

/**
 * Metadata for a private page (workspace, sign-in, investor portal).
 * Only a generic section name goes in: link previews are fetched without a session,
 * so no customer, investor, amount or order content may appear here.
 */
export function privateMetadata(title: string, description = "Xodimlar va investorlar uchun yopiq bo‘lim.", image?: string): Metadata {
  // A nested segment replaces its parent's openGraph block, so it names the parent's generated image again.
  const images = image ? [{ url: image, ...ogSize, alt: title }] : undefined;
  return {
    // Written out in full and passed on as a template: a plain string in a layout would drop the
    // root title template for the pages below it.
    title: { absolute: TITLE_TEMPLATE.replace("%s", title), template: TITLE_TEMPLATE },
    description,
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    openGraph: { title, description, siteName: brandName, type: "website", locale: "uz_UZ", images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

/** Link preview image built only from the brand name and a generic section title. */
export function privateOgImage(section: string) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#fafafa", color: "#171717", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "#615fff", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, fontWeight: 700 }}>{brandName.slice(0, 1)}</div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 600 }}>{brandName}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 700, letterSpacing: -2 }}>{section}</div>
          <div style={{ display: "flex", fontSize: 34, color: "#737373" }}>Yopiq bo‘lim. Kirish uchun hisobingizga kiring.</div>
        </div>
      </div>
    ),
    ogSize
  );
}
