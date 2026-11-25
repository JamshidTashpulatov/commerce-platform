import { brandName } from "@/lib/brand";

/** Path of the Tech Store mark, one of three arms; the mark repeats it at 0, 120 and 240 degrees. */
export const BRAND_MARK_ARM = "M340.38 192.54 L428.49 104.43 L379.21 55.14 L290.85 143.5 L290.85 18.54 L221.15 18.54 L221.15 143.5 L132.79 55.14 L83.51 104.43 L171.62 192.54 A119.33 119.33 0 0 0 340.38 192.54Z";

/**
 * Tech Store logo mark. Colour comes from `currentColor`.
 * norman: stand-in copy of the artwork, replace with the storefront's shared logo component when it lands on main.
 */
export function BrandMark({ className, title = brandName }: { className?: string; title?: string | null }) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" className={className} role={title ? "img" : undefined} aria-label={title ?? undefined} aria-hidden={title ? undefined : true}>
      <path d={BRAND_MARK_ARM} />
      <path d={BRAND_MARK_ARM} transform="rotate(120 256 256)" />
      <path d={BRAND_MARK_ARM} transform="rotate(240 256 256)" />
    </svg>
  );
}
