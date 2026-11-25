import {AdminLogin} from "../../components/admin-login";
import { TelegramLogin } from "../../components/telegram-login";

export default function LoginPage() {
  return <main className="container order-workspace">
    <h1>Hisobga kirish</h1>
    <AdminLogin/>
    <TelegramLogin/>
  </main>;
}
