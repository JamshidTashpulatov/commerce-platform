import { privateMetadata } from "@/lib/private-meta";
import { AuthFrame } from "@/components/admin/auth-frame";
import { AdminLogin } from "@/components/admin-login";

export const metadata = privateMetadata("Admin hisobini faollashtirish", undefined, "/admin/opengraph-image");

export default function Setup() {
  return (
    <AuthFrame>
      <AdminLogin activate />
    </AuthFrame>
  );
}
