import { AuthFrame } from "@/components/admin/auth-frame";
import { AdminLogin } from "@/components/admin-login";

export default function PasswordPage() {
  return (
    <AuthFrame>
      <AdminLogin change />
    </AuthFrame>
  );
}
