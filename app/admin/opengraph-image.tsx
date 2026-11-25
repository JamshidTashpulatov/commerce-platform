import { ogSize, privateOgImage } from "@/lib/private-meta";

export const alt = "Administrator";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return privateOgImage("Administrator");
}
