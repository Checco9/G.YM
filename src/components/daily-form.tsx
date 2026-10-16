"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import type { DailyLog } from "@/modules/daily/service";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Field, FormError, TextInput } from "./ui/field";
import { Icon } from "./ui/icons";
import { Sheet } from "./ui/sheet";

const QUALITY = ["", "Scarsa", "Così così", "Discreta", "Buona", "Ottima"];
const digits = (s: string) => s.replace(/\D/g, "");

export function DailyForm({ log }: { log: DailyLog }) {
  const router = useRouter();
  const [steps, setSteps] = useState(log.steps !== null ? String(log.steps) : "");
  const [h, setH] = useState(log.sleepMinutes !== null ? String(Math.floor(log.sleepMinutes / 60)) : "");
  const [m, setM] = useState(log.sleepMinutes !== null ? String(log.sleepMinutes % 60) : "");
  const [quality, setQuality] = useState<number | null>(log.sleepQuality);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const touch = () => setSaved(false);

  async function save() {
    setBusy(true);
    setError(null);
    const hasSleep = h !== "" || m !== "";
    const sleepMinutes = hasSleep ? Number(h || 0) * 60 + Number(m || 0) : null;
    if (sleepMinutes !== null && sleepMinutes > 1440) {
      setBusy(false);
      return setError("Le ore di sonno non possono superare 24");
    }
    try {
      await call("PUT", "/api/daily", { date: log.date, steps: steps === "" ? null : Number(steps), sleepMinutes, sleepQuality: hasSleep ? quality : null });
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Si è verificato un errore. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-5">
      <Field label="Passi">
        <TextInput inputMode="numeric" value={steps} onChange={(e) => { setSteps(digits(e.target.value).slice(0, 6)); touch(); }} placeholder="8000" aria-label="Passi" />
      </Field>
      <div>
        <div className="mb-1.5 text-sm font-medium text-muted">Sonno</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <TextInput inputMode="numeric" value={h} onChange={(e) => { setH(digits(e.target.value).slice(0, 2)); touch(); }} placeholder="7" aria-label="Ore di sonno" />
            <span className="mt-1 block text-sm text-muted">ore</span>
          </label>
          <label className="block">
            <TextInput inputMode="numeric" value={m} onChange={(e) => { setM(String(Math.min(59, Number(digits(e.target.value).slice(0, 2) || 0))).replace(/^0(?=\d)/, "")); touch(); }} placeholder="30" aria-label="Minuti di sonno" />
            <span className="mt-1 block text-sm text-muted">minuti</span>
          </label>
        </div>
      </div>
      {(h !== "" || m !== "") && (
        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-muted">
            <span>Qualità del sonno</span>
            <span>{quality ? QUALITY[quality] : "Facoltativa"}</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((q) => (
              <button key={q} type="button" aria-pressed={quality === q} onClick={() => { setQuality(quality === q ? null : q); touch(); }} className={`num h-12 rounded-xl text-xl font-semibold ${quality === q ? "bg-fg text-onfg" : "bg-surface2 text-muted"}`}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
      <FormError message={error} />
      <Button size="lg" className="w-full" onClick={save} disabled={busy}>
        {saved ? (<><Icon name="check" size={18} /> Salvato</>) : "Salva"}
      </Button>
    </Card>
  );
}

export function DailyGoalsButton({ stepsGoal, sleepGoalMin }: { stepsGoal: number; sleepGoalMin: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState(String(stepsGoal));
  const [h, setH] = useState(String(Math.floor(sleepGoalMin / 60)));
  const [m, setM] = useState(String(sleepGoalMin % 60));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await call("PUT", "/api/daily/goals", { stepsGoal: Number(steps), sleepGoalMin: Number(h || 0) * 60 + Number(m || 0) });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Si è verificato un errore. Riprova.");
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Obiettivi
      </Button>
      {open && (
        <Sheet title="Obiettivi giornalieri" onClose={() => setOpen(false)} footer={<Button className="w-full" onClick={save} disabled={busy}>Salva</Button>}>
          <div className="space-y-4">
            <Field label="Passi al giorno">
              <TextInput inputMode="numeric" value={steps} onChange={(e) => setSteps(digits(e.target.value).slice(0, 5))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sonno, ore">
                <TextInput inputMode="numeric" value={h} onChange={(e) => setH(digits(e.target.value).slice(0, 2))} />
              </Field>
              <Field label="Sonno, minuti">
                <TextInput inputMode="numeric" value={m} onChange={(e) => setM(digits(e.target.value).slice(0, 2))} />
              </Field>
            </div>
            <FormError message={error} />
          </div>
        </Sheet>
      )}
    </>
  );
}
