"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { Button, IconButton } from "./ui/button";
import { Card } from "./ui/card";
import { Field, FormError, TextInput } from "./ui/field";
import { ExercisePicker, type PickerExercise } from "./exercise-picker";

type Item = { key: string; exerciseId: string; name: string; targetSets: number; targetReps: number };

export function PlanEditor({
  planId,
  initial,
  exercises: initialExercises,
}: {
  planId?: string;
  initial?: { name: string; notes: string | null; exercises: { exerciseId: string; name: string; targetSets: number; targetReps: number }[] };
  exercises: PickerExercise[];
}) {
  const router = useRouter();
  const [exercises, setExercises] = useState(initialExercises);
  const [name, setName] = useState(initial?.name ?? "");
  const [items, setItems] = useState<Item[]>(
    (initial?.exercises ?? []).map((e) => ({ ...e, key: crypto.randomUUID() })),
  );
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const move = (i: number, d: -1 | 1) =>
    setItems((arr) => {
      const j = i + d;
      if (j < 0 || j >= arr.length) return arr;
      const c = [...arr];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const patch = (i: number, p: Partial<Item>) => setItems((arr) => arr.map((x, k) => (k === i ? { ...x, ...p } : x)));

  async function save() {
    setBusy(true);
    setError(null);
    const body = {
      name,
      exercises: items.map(({ exerciseId, targetSets, targetReps }) => ({ exerciseId, targetSets, targetReps })),
    };
    try {
      if (planId) await call("PUT", `/api/plans/${planId}`, body);
      else await call("POST", "/api/plans", body);
      router.push("/gym");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Errore");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Field label="Nome della scheda">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Push A" maxLength={60} />
      </Field>

      <div className="space-y-3">
        {items.length === 0 && (
          <p className="rounded-[22px] border border-dashed border-line p-6 text-center text-muted">
            Nessun esercizio. Aggiungine uno per iniziare.
          </p>
        )}
        {items.map((it, i) => (
          <Card key={it.key} className="p-4">
            <div className="flex items-center gap-1">
              <span className="num w-7 text-2xl font-semibold text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-[17px] font-semibold">{it.name}</span>
              <IconButton icon="up" label="Sposta su" onClick={() => move(i, -1)} disabled={i === 0} />
              <IconButton icon="down" label="Sposta giù" onClick={() => move(i, 1)} disabled={i === items.length - 1} />
              <IconButton icon="trash" label="Rimuovi" onClick={() => setItems((a) => a.filter((_, k) => k !== i))} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3 pl-7">
              <NumberStepper label="Serie" value={it.targetSets} min={1} max={20} onChange={(v) => patch(i, { targetSets: v })} />
              <NumberStepper label="Ripetizioni" value={it.targetReps} min={1} max={100} onChange={(v) => patch(i, { targetReps: v })} />
            </div>
          </Card>
        ))}
      </div>

      <Button variant="secondary" icon="plus" className="w-full" onClick={() => setPicker(true)}>
        Aggiungi esercizio
      </Button>
      <FormError message={error} />
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:static">
        <Button size="lg" className="w-full shadow-lg shadow-black/30" onClick={save} disabled={busy}>
          {planId ? "Salva modifiche" : "Crea scheda"}
        </Button>
      </div>

      {picker && (
        <ExercisePicker
          exercises={exercises}
          onClose={() => setPicker(false)}
          onCreated={(ex) => setExercises((l) => [...l, ex])}
          onPick={(ex) => {
            setItems((a) => [...a, { key: crypto.randomUUID(), exerciseId: ex.id, name: ex.name, targetSets: 3, targetReps: 10 }]);
            setPicker(false);
          }}
        />
      )}
    </div>
  );
}

function NumberStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-sm text-muted">{label}</div>
      <div className="flex h-11 items-center rounded-xl bg-surface2">
        <button type="button" aria-label={`Meno ${label}`} className="h-full w-11 text-xl" onClick={() => onChange(Math.max(min, value - 1))}>
          −
        </button>
        <span className="num flex-1 text-center text-xl font-semibold">{value}</span>
        <button type="button" aria-label={`Più ${label}`} className="h-full w-11 text-xl" onClick={() => onChange(Math.min(max, value + 1))}>
          +
        </button>
      </div>
    </div>
  );
}
