"use client";
import { useEffect, useState } from "react";

export function TelegramLogin() {
  const [initData, setInitData] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    // Telegram includes the signed string in the Mini App launch fragment.
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    setInitData(fragment.get("tgWebAppData") ?? "");
  }, []);

  async function login() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/telegram-mini-app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
        cache: "no-store"
      });
      if (!response.ok) {
        setError(response.status === 403 || response.status === 409
          ? "Kirish tasdiqlanmadi. Mini ilovani Telegram orqali qayta oching. Hisobingiz uchun ruxsatni administratordan tekshiring."
          : "Hozir kirib bo‘lmadi. Qayta urinib ko‘ring.");
        setBusy(false);
        return;
      }
      const { role } = await response.json();
      window.location.replace(role === "investor" ? "/investor" : "/staff");
    } catch {
      setError("Ulanish uzildi. Mini ilovani Telegram orqali qayta oching.");
      setBusy(false);
    }
  }
  return <section className="surface">
    {initData ? <button className="primary" onClick={login} disabled={busy}>
      {busy ? "Tekshirilmoqda…" : "Telegram orqali kirish"}
    </button> : <p>Kirish uchun do‘konning Telegram botidagi mini ilovani oching.</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
