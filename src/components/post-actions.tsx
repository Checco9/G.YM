"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { Button } from "./ui/button";
import { Sheet } from "./ui/sheet";

export function PostActions({ postId }: { postId: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    try {
      await call("DELETE", `/api/posts/${postId}`);
      router.replace("/feed");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Errore");
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Link href={`/feed/${postId}/edit`} className="inline-flex h-10 items-center rounded-2xl bg-surface2 px-4 text-[15px] font-semibold">
        Modifica
      </Link>
      <Button variant="danger" size="sm" onClick={() => setConfirm(true)}>
        Elimina
      </Button>
      {confirm && (
        <Sheet
          title="Eliminare il post?"
          onClose={() => setConfirm(false)}
          footer={
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>Annulla</Button>
              <Button variant="danger" className="flex-1" onClick={remove} disabled={busy}>Elimina</Button>
            </div>
          }
        >
          <p className="text-muted">Spariscono anche commenti e reazioni. L'allenamento resta nel tuo storico.</p>
          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        </Sheet>
      )}
    </div>
  );
}
