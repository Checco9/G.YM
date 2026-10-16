"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { Button } from "./ui/button";

export function StartRunButtons() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(kind: "outdoor" | "treadmill") {
    setBusy(kind);
    setError(null);
    try {
      const { id } = await call<{ id: string }>("POST", "/api/runs", { mode: "start", kind });
      router.push(`/gym/run/${id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Si è verificato un errore. Riprova.");
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <Button icon="play" size="lg" onClick={() => start("outdoor")} disabled={busy !== null}>
          All'aperto
        </Button>
        <Button variant="secondary" icon="play" size="lg" onClick={() => start("treadmill")} disabled={busy !== null}>
          Tapis roulant
        </Button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
