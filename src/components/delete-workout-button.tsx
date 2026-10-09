"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { Button } from "./ui/button";
import { Sheet } from "./ui/sheet";

export function DeleteWorkoutButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    try {
      await call("DELETE", `/api/workouts/${id}`);
      router.replace("/gym/history");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Errore");
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="danger" icon="trash" className="w-full" onClick={() => setOpen(true)}>
        Elimina allenamento
      </Button>
      {open && (
        <Sheet
          title="Eliminare l'allenamento?"
          onClose={() => setOpen(false)}
          footer={
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                Annulla
              </Button>
              <Button variant="danger" className="flex-1" onClick={remove} disabled={busy}>
                Elimina
              </Button>
            </div>
          }
        >
          <p className="text-muted">Statistiche, PR e progressi verranno ricalcolati senza questo allenamento.</p>
          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        </Sheet>
      )}
    </>
  );
}
