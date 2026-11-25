import { privateMetadata } from "@/lib/private-meta";
import { AuthFrame } from "@/components/admin/auth-frame";
import { AdminLogin } from "@/components/admin-login";
import { TelegramLogin } from "@/components/telegram-login";

export const metadata = privateMetadata("Hisobga kirish", undefined, "/login/opengraph-image");

export default function LoginPage() {
  return (
    <AuthFrame>
      <TelegramLogin />
      <AdminLogin />
    </AuthFrame>
  );
}
