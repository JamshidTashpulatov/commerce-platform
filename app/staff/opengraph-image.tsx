import { ogSize, privateOgImage } from "@/lib/private-meta";

export const alt = "Ish maydoni";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return privateOgImage("Ish maydoni");
}
