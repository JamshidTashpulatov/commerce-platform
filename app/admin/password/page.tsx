import { privateMetadata } from "@/lib/private-meta";
import { AuthFrame } from "@/components/admin/auth-frame";
import { AdminLogin } from "@/components/admin-login";

export const metadata = privateMetadata("Parolni o‘zgartirish", undefined, "/admin/opengraph-image");

export default function PasswordPage() {
  return (
    <AuthFrame>
      <AdminLogin change />
    </AuthFrame>
  );
}
