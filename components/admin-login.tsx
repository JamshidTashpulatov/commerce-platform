"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { InlineError, SubmitButton } from "@/components/admin/kit";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const copy = {
  login: { title: "Administrator uchun kirish", description: "Email va parolingizni kiriting.", submit: "Kirish" },
  activate: { title: "Admin hisobini faollashtirish", description: "Sizga berilgan bir martalik kod bilan parol belgilang.", submit: "Parolni saqlash" },
  change: { title: "Parolni o‘zgartirish", description: "Parol o‘zgargach, boshqa qurilmalardagi sessiyalar yopiladi.", submit: "Parolni saqlash" },
} as const;

export function AdminLogin({ activate = false, change = false }: { activate?: boolean; change?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mode = activate ? "activate" : change ? "change" : "login";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const fields = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, email: fields.get("email"), password: fields.get("password"), code: fields.get("code"), newPassword: fields.get("newPassword") }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(typeof data?.error === "string" ? data.error : "Kirib bo‘lmadi. Qayta urinib ko‘ring.");
        setBusy(false);
        return;
      }
      window.location.replace("/staff");
    } catch {
      setError("Ulanishni tekshirib, qayta urinib ko‘ring.");
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>{copy[mode].title}</h1>
        </CardTitle>
        <CardDescription>{copy[mode].description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="admin-email">Email</FieldLabel>
              <Input id="admin-email" name="email" type="email" autoComplete="username" maxLength={254} required disabled={busy} />
            </Field>
            {activate && (
              <Field>
                <FieldLabel htmlFor="admin-code">Faollashtirish kodi</FieldLabel>
                <Input id="admin-code" name="code" type="password" autoComplete="off" required disabled={busy} />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="admin-password">{activate ? "Yangi parol" : change ? "Joriy parol" : "Parol"}</FieldLabel>
              <Input id="admin-password" name="password" type="password" minLength={activate ? 15 : 1} autoComplete={activate ? "new-password" : "current-password"} required disabled={busy} />
              {activate && <FieldDescription>Kamida 15 belgi.</FieldDescription>}
            </Field>
            {change && (
              <Field>
                <FieldLabel htmlFor="admin-new-password">Yangi parol</FieldLabel>
                <Input id="admin-new-password" name="newPassword" type="password" minLength={15} autoComplete="new-password" required disabled={busy} />
                <FieldDescription>Kamida 15 belgi.</FieldDescription>
              </Field>
            )}
            <InlineError message={error} />
            <Field>
              <SubmitButton busy={busy}>{copy[mode].submit}</SubmitButton>
              {change && (
                <FieldDescription className="text-center">
                  <Link href="/staff">Ish maydoniga qaytish</Link>
                </FieldDescription>
              )}
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
