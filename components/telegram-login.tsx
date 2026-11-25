"use client";

import { useEffect, useState } from "react";
import { SendIcon } from "lucide-react";
import { InlineError } from "@/components/admin/kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

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
        cache: "no-store",
      });
      if (!response.ok) {
        setError(
          response.status === 403 || response.status === 409
            ? "Kirish tasdiqlanmadi. Mini ilovani Telegram orqali qayta oching. Hisobingiz uchun ruxsatni administratordan tekshiring."
            : "Hozir kirib bo‘lmadi. Qayta urinib ko‘ring."
        );
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
  if (!initData) {
    return <p className="order-last text-center text-sm text-balance text-muted-foreground">Sotuvchi yoki investor sifatida kirish uchun do‘konning Telegram botidagi mini ilovani oching.</p>;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Telegram orqali kirish</h2>
        </CardTitle>
        <CardDescription>Sotuvchi va investorlar Telegram hisobi orqali kiradi.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button type="button" size="lg" onClick={login} disabled={busy}>
          {busy ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
          {busy ? "Tekshirilmoqda…" : "Telegram orqali kirish"}
        </Button>
        <InlineError message={error} />
      </CardContent>
    </Card>
  );
}
