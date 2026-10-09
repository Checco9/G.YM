"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "./ui/icons";

export const MODE_EVENT = "gym:mode";
export type Mode = "diet" | "gym";

const inMode = (path: string, mode: Mode) => (mode === "diet") === path.startsWith("/diet");
const MIN_MS = 450;

/**
 * Schermata di passaggio tra modalità Palestra e Dieta. Appare subito al tocco, resta almeno un attimo
 * per rendere chiaro il cambio e sparisce quando la nuova modalità è pronta.
 */
export function ModeTransition() {
  const pathname = usePathname();
  const [mode, setMode] = useState<Mode | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    const on = (e: Event) => {
      startedAt.current = Date.now();
      setMode((e as CustomEvent<Mode>).detail);
    };
    window.addEventListener(MODE_EVENT, on);
    return () => window.removeEventListener(MODE_EVENT, on);
  }, []);

  useEffect(() => {
    if (!mode || !inMode(pathname, mode)) return;
    const t = setTimeout(() => setMode(null), Math.max(0, MIN_MS - (Date.now() - startedAt.current)));
    return () => clearTimeout(t);
  }, [pathname, mode]);

  // rete di sicurezza: l'overlay non resta mai bloccato
  useEffect(() => {
    if (!mode) return;
    const t = setTimeout(() => setMode(null), 10000);
    return () => clearTimeout(t);
  }, [mode]);

  if (!mode) return null;
  return (
    <div role="status" aria-live="polite" className="fade-in fixed inset-0 z-[100] flex flex-col items-center justify-center gap-7 bg-bg">
      <span className="plate-spin text-fg">
        <Logo size={64} />
      </span>
      <div className="text-center">
        <div className="num text-4xl font-semibold">{mode === "diet" ? "Modalità Dieta" : "Modalità Palestra"}</div>
        <div className="mt-1 text-muted">Caricamento in corso</div>
      </div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-surface2">
        <div className="bar-slide h-full w-1/3 rounded-full bg-fg" />
      </div>
    </div>
  );
}
