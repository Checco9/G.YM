"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { Button } from "./ui/button";
import { Sheet } from "./ui/sheet";

export function DeleteRunButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    try {
      await call("DELETE", `/api/runs/${id}`);
      router.replace("/gym/runs");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Si è verificato un errore. Riprova.");
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="danger" icon="trash" className="w-full" onClick={() => setOpen(true)}>
        Elimina corsa
      </Button>
      {open && (
        <Sheet
          title="Eliminare la corsa?"
          onClose={() => setOpen(false)}
          footer={
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>Annulla</Button>
              <Button variant="danger" className="flex-1" onClick={remove} disabled={busy}>Elimina</Button>
            </div>
          }
        >
          <p className="text-muted">La corsa verrà rimossa dallo storico e dalle statistiche.</p>
          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        </Sheet>
      )}
    </>
  );
}
