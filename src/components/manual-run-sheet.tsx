"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { parseDuration } from "@/modules/runs/domain/run";
import { Button } from "./ui/button";
import { Field, FormError, Select, TextInput } from "./ui/field";
import { Sheet } from "./ui/sheet";

export const EFFORT_LABEL = ["", "Molto facile", "Facile", "Facile", "Leggero", "Moderato", "Impegnativo", "Duro", "Molto duro", "Quasi al massimo", "Massimo"];

export function EffortPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-muted">
        <span>Sforzo percepito</span>
        <span>{value ? `${value}, ${EFFORT_LABEL[value].toLowerCase()}` : "Facoltativo"}</span>
      </div>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" aria-pressed={value === n} onClick={() => onChange(value === n ? null : n)} className={`num h-11 rounded-xl text-xl font-semibold ${value === n ? "bg-fg text-onfg" : "bg-surface2 text-muted"}`}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Registra una corsa già fatta: data, distanza e durata. */
export function ManualRunSheet({ today, onClose }: { today: string; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({ date: today, time: "07:00", kind: "outdoor", distance: "", duration: "", notes: "" });
  const [effort, setEffort] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    const km = parseFloat(f.distance.replace(",", "."));
    const durationS = parseDuration(f.duration);
    if (!Number.isFinite(km) || km <= 0) return setError("Inserisci la distanza in chilometri");
    if (!durationS) return setError("Durata non valida: scrivi per esempio 45:30 oppure 1:05:00");
    setBusy(true);
    setError(null);
    try {
      const { id } = await call<{ id: string }>("POST", "/api/runs", { mode: "manual", date: f.date, time: f.time, kind: f.kind, distanceM: Math.round(km * 1000), durationS, effort, notes: f.notes || null });
      router.push(`/gym/runs/${id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Si è verificato un errore. Riprova.");
      setBusy(false);
    }
  }

  return (
    <Sheet
      title="Registra una corsa"
      onClose={onClose}
      footer={
        <Button className="w-full" onClick={save} disabled={busy}>
          Salva corsa
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data">
            <TextInput type="date" value={f.date} max={today} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Ora di inizio">
            <TextInput type="time" value={f.time} onChange={(e) => set("time", e.target.value)} />
          </Field>
          <Field label="Distanza (km)">
            <TextInput inputMode="decimal" value={f.distance} onChange={(e) => set("distance", e.target.value)} placeholder="5,2" />
          </Field>
          <Field label="Durata" hint="Es. 28:30 o 1:05:00">
            <TextInput value={f.duration} onChange={(e) => set("duration", e.target.value)} placeholder="28:30" />
          </Field>
        </div>
        <Field label="Tipo">
          <Select value={f.kind} onChange={(e) => set("kind", e.target.value)}>
            <option value="outdoor">All'aperto</option>
            <option value="treadmill">Tapis roulant</option>
          </Select>
        </Field>
        <EffortPicker value={effort} onChange={setEffort} />
        <Field label="Note (facoltative)">
          <TextInput value={f.notes} onChange={(e) => set("notes", e.target.value)} maxLength={500} />
        </Field>
        <FormError message={error} />
      </div>
    </Sheet>
  );
}
