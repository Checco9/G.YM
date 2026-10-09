"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { Card } from "./ui/card";
import { IconButton } from "./ui/button";
import { Sheet } from "./ui/sheet";
import { Button } from "./ui/button";
import { StartWorkoutButton } from "./start-workout-button";

export function PlanCard({ plan }: { plan: { id: string; name: string; exerciseNames: string[] } }) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function duplicate() {
    setBusy(true);
    try {
      await call("POST", `/api/plans/${plan.id}/duplicate`);
      setMenu(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Errore");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await call("DELETE", `/api/plans/${plan.id}`);
      setConfirm(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Errore");
      setBusy(false);
    }
  }

  const shown = plan.exerciseNames.slice(0, 5);
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/gym/plans/${plan.id}`} className="min-w-0 flex-1">
          <h3 className="num truncate text-[28px] font-semibold leading-tight">{plan.name}</h3>
          <p className="mt-0.5 text-sm text-muted">
            {plan.exerciseNames.length} {plan.exerciseNames.length === 1 ? "esercizio" : "esercizi"}
          </p>
        </Link>
        <IconButton icon="more" label="Altre azioni" onClick={() => setMenu(true)} className="-mr-2 -mt-1" />
      </div>
      {shown.length > 0 && (
        <ol className="mt-3 space-y-0.5 text-[15px] text-muted">
          {shown.map((n, i) => (
            <li key={i} className="truncate">
              {i + 1}. {n}
            </li>
          ))}
          {plan.exerciseNames.length > shown.length && <li>… altri {plan.exerciseNames.length - shown.length}</li>}
        </ol>
      )}
      <div className="mt-5">
        <StartWorkoutButton planId={plan.id} label="Inizia allenamento" className="w-full" />
      </div>

      {menu && (
        <Sheet title={plan.name} onClose={() => setMenu(false)}>
          <div className="flex flex-col gap-2">
            <Link href={`/gym/plans/${plan.id}`} className="flex h-12 items-center rounded-2xl bg-surface2 px-4 font-semibold">
              Modifica scheda
            </Link>
            <Button variant="secondary" onClick={duplicate} disabled={busy} className="justify-start">
              Duplica scheda
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setMenu(false);
                setConfirm(true);
              }}
              className="justify-start"
            >
              Elimina scheda
            </Button>
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        </Sheet>
      )}
      {confirm && (
        <Sheet
          title="Eliminare la scheda?"
          onClose={() => setConfirm(false)}
          footer={
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>
                Annulla
              </Button>
              <Button variant="danger" className="flex-1" onClick={remove} disabled={busy}>
                Elimina
              </Button>
            </div>
          }
        >
          <p className="text-muted">Gli allenamenti già svolti con questa scheda restano nello storico.</p>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </Sheet>
      )}
    </Card>
  );
}
