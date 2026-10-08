"use client";

import { useMemo, useState } from "react";
import { MUSCLES } from "@/config/muscles";
import { call, ApiError } from "@/lib/client-api";
import type { ExerciseRow } from "@/modules/exercises/repository";
import { Button } from "./ui/button";
import { Field, FormError, Select, TextInput } from "./ui/field";
import { Icon } from "./ui/icons";
import { Sheet } from "./ui/sheet";

export type PickerExercise = Pick<ExerciseRow, "id" | "name" | "category" | "muscles" | "isCustom">;

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Scelta dell'esercizio con ricerca, filtro per muscolo e creazione di esercizi personali. */
export function ExercisePicker({
  exercises,
  onPick,
  onClose,
  onCreated,
}: {
  exercises: PickerExercise[];
  onPick: (ex: PickerExercise) => void;
  onClose: () => void;
  onCreated?: (ex: PickerExercise) => void;
}) {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const list = useMemo(() => {
    const nq = norm(q.trim());
    return exercises.filter(
      (e) =>
        (!nq || norm(e.name).includes(nq)) &&
        (!muscle || e.muscles.some((m) => m.muscleId === muscle && m.role === "primary")),
    );
  }, [exercises, q, muscle]);

  if (creating) {
    return (
      <CreateExercise
        initialName={q}
        onBack={() => setCreating(false)}
        onClose={onClose}
        onCreated={(ex) => {
          onCreated?.(ex);
          onPick(ex);
        }}
      />
    );
  }

  return (
    <Sheet title="Scegli esercizio" onClose={onClose}>
      <TextInput
        placeholder="Cerca esercizio"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Cerca esercizio"
        autoFocus
      />
      <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
        <Chip active={muscle === null} onClick={() => setMuscle(null)}>
          Tutti
        </Chip>
        {MUSCLES.map((m) => (
          <Chip key={m.id} active={muscle === m.id} onClick={() => setMuscle(m.id === muscle ? null : m.id)}>
            {m.name}
          </Chip>
        ))}
      </div>
      <ul className="mt-3 divide-y divide-line">
        {list.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onPick(e)}
              className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left"
            >
              <span className="text-[17px] font-medium">{e.name}</span>
              {e.isCustom && <span className="rounded-full bg-surface2 px-2.5 py-0.5 text-xs text-muted">Personale</span>}
            </button>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="py-6 text-center text-muted">Nessun esercizio trovato.</p>}
      <Button variant="secondary" icon="plus" className="mt-3 w-full" onClick={() => setCreating(true)}>
        Crea esercizio personale
      </Button>
    </Sheet>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold ${active ? "bg-fg text-onfg" : "bg-surface2 text-muted"}`}
    >
      {children}
    </button>
  );
}

function CreateExercise({
  initialName,
  onBack,
  onClose,
  onCreated,
}: {
  initialName: string;
  onBack: () => void;
  onClose: () => void;
  onCreated: (ex: PickerExercise) => void;
}) {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState<"compound" | "isolation" | "bodyweight">("compound");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const { id } = await call<{ id: string }>("POST", "/api/exercises", { name, category, primaryMuscles: selected });
      onCreated({
        id,
        name: name.trim(),
        category,
        isCustom: true,
        muscles: selected.map((muscleId) => ({ muscleId, role: "primary" as const })),
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Errore");
      setBusy(false);
    }
  }

  return (
    <Sheet
      title="Nuovo esercizio"
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onBack} className="flex-1">
            Indietro
          </Button>
          <Button onClick={save} disabled={busy} className="flex-1">
            Crea e aggiungi
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Nome">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
        </Field>
        <Field label="Tipo">
          <Select value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
            <option value="compound">Multiarticolare</option>
            <option value="isolation">Isolamento</option>
            <option value="bodyweight">Corpo libero</option>
          </Select>
        </Field>
        <div>
          <div className="mb-1.5 text-sm font-medium text-muted">Muscoli principali</div>
          <div className="flex flex-wrap gap-2">
            {MUSCLES.map((m) => {
              const on = selected.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelected(on ? selected.filter((x) => x !== m.id) : [...selected, m.id].slice(0, 4))}
                  className={`h-10 rounded-full px-4 text-[15px] font-semibold ${on ? "bg-fg text-onfg" : "bg-surface2 text-muted"}`}
                >
                  {on && <Icon name="check" size={14} className="mr-1 inline" />}
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-sm text-muted">
          Gli esercizi personali non hanno un livello di forza, ma le serie contano per volume, PR e progressi.
        </p>
        <FormError message={error} />
      </div>
    </Sheet>
  );
}
