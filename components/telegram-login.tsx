"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { PhoneIcon, SendIcon } from "lucide-react";
import { InlineError } from "@/components/admin/kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

type TelegramWebApp = { isVersionAtLeast?: (version: string) => boolean; requestContact?: (callback?: (shared: boolean) => void) => void };
const webApp = () => (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
const refused = "Kirish tasdiqlanmadi. Hisobingiz uchun ruxsatni administratordan tekshiring.";
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function TelegramLogin() {
  const [initData, setInitData] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // "phone": Telegram does not know this user yet, so offer to confirm the phone the admin registered.
  const [stage, setStage] = useState<"start" | "phone" | "waiting">("start");
  const alive = useRef(true);
  useEffect(() => {
    // Telegram includes the signed string in the Mini App launch fragment.
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    setInitData(fragment.get("tgWebAppData") ?? "");
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function attempt() {
    const response = await fetch("/api/auth/telegram-mini-app", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
      cache: "no-store",
    });
    if (response.ok) {
      const { role } = await response.json();
      window.location.replace(role === "investor" ? "/investor" : "/staff");
    }
    return response.status;
  }

  async function login() {
    setBusy(true);
    setError("");
    try {
      const status = await attempt();
      if (status === 200) return;
      if (status === 403) {
        // The refusal is the same whether or not a phone is registered; the next step is offered to everyone.
        const app = webApp();
        if (app?.requestContact && (!app.isVersionAtLeast || app.isVersionAtLeast("6.9"))) setStage("phone");
        else setError(refused);
      } else if (status === 409) setError("Bu kirish havolasi ishlatilgan. Mini ilovani Telegram orqali qayta oching.");
      else setError("Hozir kirib bo‘lmadi. Qayta urinib ko‘ring.");
      setBusy(false);
    } catch {
      setError("Ulanish uzildi. Mini ilovani Telegram orqali qayta oching.");
      setBusy(false);
    }
  }

  function confirmPhone() {
    const app = webApp();
    if (!app?.requestContact) return;
    setError("");
    setBusy(true);
    // Telegram shows its own prompt and, if the person agrees, sends the contact straight to the bot.
    app.requestContact(async shared => {
      if (!alive.current) return;
      if (!shared) {
        setError("Telefon raqam ulashilmadi. Kirish uchun raqamni tasdiqlash kerak.");
        setBusy(false);
        return;
      }
      setStage("waiting");
      try {
        // The bot receives the contact a moment later, so try a few times.
        for (let i = 0; i < 8 && alive.current; i++) {
          await wait(1500);
          const status = await attempt();
          if (status === 200) return;
          if (status !== 403) break;
        }
      } catch {}
      if (!alive.current) return;
      setStage("phone");
      setError(refused + " Agar raqamingiz ro‘yxatda bo‘lsa, mini ilovani qayta ochib ko‘ring.");
      setBusy(false);
    });
  }

  if (!initData) {
    return <p className="order-last text-center text-sm text-balance text-muted-foreground">Sotuvchi yoki investor sifatida kirish uchun do‘konning Telegram botidagi mini ilovani oching.</p>;
  }
  return (
    <Card>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      <CardHeader>
        <CardTitle>
          <h2>{stage === "start" ? "Telegram orqali kirish" : "Telefon raqamni tasdiqlang"}</h2>
        </CardTitle>
        <CardDescription>
          {stage === "start"
            ? "Sotuvchi va investorlar Telegram hisobi orqali kiradi."
            : stage === "waiting"
              ? "Raqam tekshirilmoqda. Bir necha soniya kuting."
              : "Bu Telegram hisobi hali ulanmagan. Administrator sizni telefon raqamingiz bo‘yicha qo‘shgan bo‘lsa, raqamingizni Telegram orqali bir marta tasdiqlang. Raqamni yozish shart emas, Telegram o‘zi yuboradi."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {stage === "start" ? (
          <Button type="button" size="lg" onClick={login} disabled={busy}>
            {busy ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
            {busy ? "Tekshirilmoqda…" : "Telegram orqali kirish"}
          </Button>
        ) : (
          <Button type="button" size="lg" onClick={confirmPhone} disabled={busy}>
            {busy ? <Spinner data-icon="inline-start" /> : <PhoneIcon data-icon="inline-start" />}
            {stage === "waiting" ? "Tekshirilmoqda…" : "Telefon raqamni tasdiqlash"}
          </Button>
        )}
        <InlineError message={error} />
      </CardContent>
    </Card>
  );
}
