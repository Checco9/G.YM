"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { Button } from "./ui/button";
import type { IconName } from "./ui/icons";

export function StartWorkoutButton({
  planId,
  label = "Inizia",
  variant = "primary",
  size = "md",
  icon = "play",
  className,
}: {
  planId?: string;
  label?: string;
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  icon?: IconName;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const { id } = await call<{ id: string }>("POST", "/api/workouts", { planId: planId ?? null });
      router.push(`/gym/workout/${id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Errore");
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant={variant} size={size} icon={icon} onClick={start} disabled={busy} className={className}>
        {label}
      </Button>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </>
  );
}
