import { AuthFrame } from "@/components/admin/auth-frame";
import { AdminLogin } from "@/components/admin-login";

export default function Setup() {
  return (
    <AuthFrame>
      <AdminLogin activate />
    </AuthFrame>
  );
}
