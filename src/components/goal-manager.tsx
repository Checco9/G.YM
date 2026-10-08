"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { fmtDate, fmtNum } from "@/lib/format";
import type { GoalView } from "@/modules/goals/service";
import { Button, IconButton } from "./ui/button";
import { Card, EmptyState } from "./ui/card";
import { Field, FormError, Select, TextInput } from "./ui/field";
import { Icon } from "./ui/icons";
import { ProgressBar } from "./ui/progress";
import { Sheet } from "./ui/sheet";

type Kind = GoalView["kind"];
const LABEL: Record<Kind, string> = {
  exercise_weight: "Carico da raggiungere (kg)",
  exercise_1rm: "1RM stimato da raggiungere (kg)",
  body_weight: "Peso da raggiungere (kg)",
  workout_count: "Quanti allenamenti",
  total_volume: "Volume totale (kg)",
  streak_weeks: "Quante settimane di fila",
};
const PLACEHOLDER: Record<Kind, string> = { exercise_weight: "60", exercise_1rm: "100", body_weight: "80", workout_count: "100", total_volume: "100000", streak_weeks: "8" };

export function GoalManager({ goals, exercises, tz }: { goals: GoalView[]; exercises: { id: string; name: string }[]; tz: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function remove(id: string) {
    setBusyId(id);
    try {
      await call("DELETE", `/api/goals/${id}`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const active = goals.filter((g) => !g.achieved);
  const done = goals.filter((g) => g.achieved);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-muted">{goals.length ? "I tuoi obiettivi" : ""}</p>
        <Button icon="plus" size="sm" onClick={() => setOpen(true)}>
          Nuovo obiettivo
        </Button>
      </div>

      {goals.length === 0 && (
        <EmptyState
          title="Nessun obiettivo"
          text="Scegli un traguardo semplice: un carico da raggiungere, un peso o un numero di allenamenti."
          action={<Button icon="plus" onClick={() => setOpen(true)}>Crea obiettivo</Button>}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {[...active, ...done].map((g) => (
          <GoalCard key={g.id} g={g} tz={tz} busy={busyId === g.id} onDelete={() => remove(g.id)} />
        ))}
      </div>

      {open && <NewGoal exercises={exercises} onClose={() => setOpen(false)} onDone={() => { setOpen(false); router.refresh(); }} />}
    </div>
  );
}

export function GoalCard({ g, tz, onDelete, busy }: { g: GoalView; tz: string; onDelete?: () => void; busy?: boolean }) {
  const unit = g.unit === "kg" ? " kg" : "";
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="num text-[26px] font-semibold leading-tight">{g.title}</h3>
          {g.achieved && (
            <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold">
              <Icon name="check" size={16} /> Raggiunto
            </span>
          )}
        </div>
        {onDelete && <IconButton icon="trash" label="Elimina obiettivo" onClick={onDelete} disabled={busy} className="-mr-2 -mt-1" />}
      </div>
      <div className="mt-4 flex items-baseline justify-between">
        <span className="num text-4xl font-semibold">{g.percent}%</span>
        <span className="text-sm text-muted">
          {fmtNum(g.currentValue, 2)}
          {unit} di {fmtNum(g.targetValue, 2)}
          {g.unit === "kg" ? unit : ` ${g.unit}`}
        </span>
      </div>
      <ProgressBar percent={g.percent} className="mt-2" />
      <div className="mt-2 flex justify-between text-sm text-muted">
        <span>Partenza {fmtNum(g.startValue, 2)}{unit}</span>
        {g.deadline && <span>Entro il {fmtDate(g.deadline + "T12:00:00Z", "UTC", { day: "numeric", month: "long", year: "numeric" })}</span>}
      </div>
    </Card>
  );
}

function NewGoal({ exercises, onClose, onDone }: { exercises: { id: string; name: string }[]; onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState<Kind>("exercise_weight");
  const [exerciseId, setExerciseId] = useState(exercises[0]?.id ?? "");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const t = parseFloat(target.replace(",", "."));
    if (!Number.isFinite(t) || t <= 0) return setError("Inserisci un valore target valido");
    setBusy(true);
    setError(null);
    try {
      await call("POST", "/api/goals", {
        kind,
        exerciseId: kind === "exercise_weight" || kind === "exercise_1rm" ? exerciseId : null,
        targetValue: t,
        deadline: deadline || null,
        title: title || undefined,
      });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Errore");
      setBusy(false);
    }
  }

  return (
    <Sheet
      title="Nuovo obiettivo"
      onClose={onClose}
      footer={
        <Button className="w-full" onClick={save} disabled={busy}>
          Crea obiettivo
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Tipo">
          <Select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            <option value="exercise_weight">Carico in un esercizio</option>
            <option value="exercise_1rm">1RM stimato in un esercizio</option>
            <option value="body_weight">Peso corporeo</option>
            <option value="workout_count">Numero di allenamenti</option>
            <option value="total_volume">Volume totale sollevato</option>
            <option value="streak_weeks">Settimane di fila</option>
          </Select>
        </Field>
        {(kind === "exercise_weight" || kind === "exercise_1rm") && (
          <Field label="Esercizio">
            <Select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
              {exercises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={LABEL[kind]}>
          <TextInput inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={PLACEHOLDER[kind]} />
        </Field>
        <Field label="Titolo (facoltativo)">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Lo ricavo dai dati" />
        </Field>
        <Field label="Data limite (facoltativa)">
          <TextInput type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
        <FormError message={error} />
      </div>
    </Sheet>
  );
}
