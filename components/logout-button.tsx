"use client";
import { useState } from "react";
import { staffFetch } from "../lib/staff-client";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await staffFetch("/api/auth/logout", "POST", {});
      window.location.replace("/login");
    } catch {
      setError("Hisobdan chiqib bo‘lmadi. Qayta urinib ko‘ring.");
      setBusy(false);
    }
  }
  return <><button className="secondary" disabled={busy} onClick={logout}>Hisobdan chiqish</button>
    {error && <p role="alert">{error}</p>}</>;
}
