"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { call } from "@/lib/client-api";
import { Button } from "./ui/button";

const OPTIONS = [
  { v: "dark", label: "Scuro" },
  { v: "light", label: "Chiaro" },
  { v: "system", label: "Automatico" },
] as const;

export function ThemeSwitcher({ initial }: { initial: string }) {
  const [theme, setTheme] = useState(initial);
  function pick(v: string) {
    setTheme(v);
    document.documentElement.dataset.theme = v;
    document.cookie = `ghisa_theme=${v}; path=/; max-age=31536000; samesite=lax`;
  }
  return (
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 rounded-full bg-surface2 p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.v}
          role="radio"
          aria-checked={theme === o.v}
          onClick={() => pick(o.v)}
          className={`h-10 rounded-full text-[15px] font-semibold ${theme === o.v ? "bg-fg text-onfg" : "text-muted"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      icon="logout"
      className="w-full"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await call("POST", "/api/auth/logout").catch(() => {});
        router.replace("/login");
        router.refresh();
      }}
    >
      Esci
    </Button>
  );
}
