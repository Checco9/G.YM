"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { call } from "@/lib/client-api";
import { Button } from "./ui/button";

export function LeaderboardOptIn({ optIn }: { optIn: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={optIn ? "ghost" : "primary"}
      size={optIn ? "sm" : "md"}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await call("PUT", "/api/leaderboard", { optIn: !optIn }).catch(() => {});
        router.refresh();
        setBusy(false);
      }}
    >
      {optIn ? "Esci dalla classifica" : "Partecipa alla classifica"}
    </Button>
  );
}
