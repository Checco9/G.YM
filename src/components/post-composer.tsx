"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { Button } from "./ui/button";
import { FormError } from "./ui/field";
import { Icon } from "./ui/icons";

type Photo = { path: string; width: number; height: number };

const MAX_SIDE = 1080;

/**
 * Ridimensiona e ricomprime la foto nel telefono prima dell'invio: pesa 100-250 KB invece di
 * diversi MB (invio e caricamento più rapidi) e la ricodifica elimina anche EXIF e posizione GPS.
 */
async function toJpeg(file: File): Promise<Blob> {
  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Immagine non leggibile"));
      img.src = URL.createObjectURL(file);
    });
  }
  const w = "naturalWidth" in bitmap ? bitmap.naturalWidth : bitmap.width;
  const h = "naturalHeight" in bitmap ? bitmap.naturalHeight : bitmap.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Conversione fallita"))), "image/jpeg", 0.82));
}

export function PostComposer({
  workout,
  postId,
  initial,
  photosEnabled,
}: {
  workout: { id: string; name: string; date: string };
  postId?: string;
  initial?: { caption: string; photoUrl: string | null };
  photosEnabled: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState(initial?.caption ?? "");
  const [preview, setPreview] = useState<string | null>(initial?.photoUrl ?? null);
  /** undefined = invariata (solo in modifica), null = nessuna/rimossa, oggetto = nuova foto caricata */
  const [photo, setPhoto] = useState<Photo | null | undefined>(postId ? undefined : null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const blob = await toJpeg(file);
      const res = await fetch("/api/photos", { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Caricamento non riuscito");
      setPhoto({ path: data.path, width: data.width, height: data.height });
      setPreview(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Caricamento non riuscito");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto() {
    setPhoto(null);
    setPreview(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (postId) {
        await call("PUT", `/api/posts/${postId}`, { caption, ...(photo === undefined ? {} : { photo }) });
        router.push(`/feed/${postId}`);
      } else {
        const r = await call<{ id: string }>("POST", "/api/posts", { workoutId: workout.id, caption, photo });
        router.push(`/feed/${r.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Errore");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="rounded-2xl bg-surface p-4">
        <div className="text-sm text-muted">Allenamento collegato</div>
        <div className="num text-2xl font-semibold">{workout.name}</div>
        <div className="text-sm text-muted">{workout.date}</div>
      </div>

      {photosEnabled && (
        <div>
          <input ref={fileRef} type="file" accept="image/*" onChange={pick} className="sr-only" aria-label="Scegli una foto" />
          {preview ? (
            <div className="relative overflow-hidden rounded-2xl bg-surface2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Anteprima della foto" className="mx-auto max-h-[420px] w-full object-cover" />
              <div className="absolute right-3 top-3 flex gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} className="h-10 rounded-full bg-bg/85 px-4 text-sm font-semibold backdrop-blur">
                  Cambia
                </button>
                <button type="button" onClick={removePhoto} className="h-10 rounded-full bg-bg/85 px-4 text-sm font-semibold backdrop-blur">
                  Rimuovi
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-muted"
            >
              <Icon name="camera" size={30} />
              <span className="font-semibold">{uploading ? "Preparo la foto…" : "Aggiungi una foto"}</span>
            </button>
          )}
        </div>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">Descrizione</span>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="Come è andata?"
          className="w-full resize-none rounded-2xl bg-surface2 px-4 py-3 text-[17px] outline-none ring-1 ring-transparent placeholder:text-muted/70 focus:ring-fg"
        />
        <span className="mt-1 block text-right text-sm text-muted">{caption.length}/500</span>
      </label>

      <FormError message={error} />
      <Button type="submit" size="lg" className="w-full" disabled={busy || uploading}>
        {postId ? "Salva modifiche" : "Pubblica nel feed"}
      </Button>
    </form>
  );
}
