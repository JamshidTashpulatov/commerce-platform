// Tech Store logo: one arrow shape repeated at 0, 120 and 240 degrees around the
// centre of a 512x512 box (16 units of padding built in). Source: Jamik's logo,
// rebuilt as clean geometry; the original SVG is assets/brand/tech-store-mark.svg.
export const BRAND_MARK_VIEWBOX="0 0 512 512";
export const BRAND_MARK_D="M340.38 192.54 L428.49 104.43 L379.21 55.14 L290.85 143.5 L290.85 18.54 L221.15 18.54 L221.15 143.5 L132.79 55.14 L83.51 104.43 L171.62 192.54 A119.33 119.33 0 0 0 340.38 192.54Z";
export const BRAND_MARK_ROTATIONS=[0,120,240] as const;

/** The mark as standalone SVG markup (three explicit paths, no ids), for icon generation. */
export function brandMarkSvg({fill="#1d1d1f",background,padding=0,radius=0,size=512}:{fill?:string;background?:string;padding?:number;radius?:number;size?:number}={}){
  const scale=(512-2*padding)/512;
  const paths=BRAND_MARK_ROTATIONS.map(r=>`<path d="${BRAND_MARK_D}"${r?` transform="rotate(${r} 256 256)"`:""}/>`).join("");
  const bg=background?`<rect width="512" height="512" rx="${radius}" fill="${background}"/>`:"";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">${bg}<g fill="${fill}" transform="translate(${padding} ${padding}) scale(${scale})">${paths}</g></svg>`;
}
