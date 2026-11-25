import { AuthFrame } from "@/components/admin/auth-frame";
import { AdminLogin } from "@/components/admin-login";
import { TelegramLogin } from "@/components/telegram-login";

export default function LoginPage() {
  return (
    <AuthFrame>
      <TelegramLogin />
      <AdminLogin />
    </AuthFrame>
  );
}
