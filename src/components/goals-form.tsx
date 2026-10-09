"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { fmtNum } from "@/lib/format";
import { kcalFromMacros } from "@/modules/diet/domain/nutrition";
import { ACTIVITY, OBJECTIVE, SPLIT_PRESETS, macroMismatchPercent, splitByPercent, suggestTargets, type Activity, type Objective } from "@/modules/diet/domain/targets";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Field, FormError, Select, TextInput } from "./ui/field";
import { Icon } from "./ui/icons";

type Initial = { kcal: number; proteinG: number; carbsG: number; fatG: number; waterMl: number } | null;
type Defaults = { sex: "male" | "female" | null; age: number | null; heightCm: number | null; weightKg: number | null };

const int = (s: string) => {
  const n = parseInt(s.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

export function GoalsForm({ initial, defaults }: { initial: Initial; defaults: Defaults }) {
  const router = useRouter();
  const [f, setF] = useState({
    kcal: initial ? String(initial.kcal) : "",
    protein: initial ? String(initial.proteinG) : "",
    carbs: initial ? String(initial.carbsG) : "",
    fat: initial ? String(initial.fatG) : "",
    water: String(initial?.waterMl ?? 2000),
  });
  const [calc, setCalc] = useState({
    sex: defaults.sex ?? "male",
    age: defaults.age ? String(defaults.age) : "",
    height: defaults.heightCm ? String(defaults.heightCm) : "",
    weight: defaults.weightKg ? String(Math.round(defaults.weightKg)) : "",
    activity: "moderate" as Activity,
    objective: "maintain" as Objective,
  });
  const [open, setOpen] = useState(!initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => {
    setF((x) => ({ ...x, [k]: v.replace(/\D/g, "") }));
    setSaved(false);
  };

  const [kcal, p, c, g] = [int(f.kcal), int(f.protein), int(f.carbs), int(f.fat)];
  const mismatch = kcal > 0 ? macroMismatchPercent(kcal, p, c, g) : 0;

  const cInput = { sex: calc.sex as "male" | "female", age: int(calc.age), heightCm: int(calc.height), weightKg: int(calc.weight), activity: calc.activity, objective: calc.objective };
  const valid = cInput.age >= 14 && cInput.age <= 90 && cInput.heightCm >= 120 && cInput.heightCm <= 220 && cInput.weightKg >= 30 && cInput.weightKg <= 250;
  const suggestion = valid ? suggestTargets(cInput) : null;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await call("PUT", "/api/diet/goals", { kcal, proteinG: p, carbsG: c, fatG: g, waterMl: int(f.water) });
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Errore");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between text-left">
          <div>
            <h2 className="num text-2xl font-semibold">Calcola per me</h2>
            <p className="text-sm text-muted">Una stima di partenza in base al tuo corpo e al tuo obiettivo</p>
          </div>
          <Icon name={open ? "up" : "down"} />
        </button>
        {open && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sesso">
                <Select value={calc.sex} onChange={(e) => setCalc({ ...calc, sex: e.target.value as "male" | "female" })}>
                  <option value="male">Uomo</option>
                  <option value="female">Donna</option>
                </Select>
              </Field>
              <Field label="Età">
                <TextInput inputMode="numeric" value={calc.age} onChange={(e) => setCalc({ ...calc, age: e.target.value })} placeholder="30" />
              </Field>
              <Field label="Altezza (cm)">
                <TextInput inputMode="numeric" value={calc.height} onChange={(e) => setCalc({ ...calc, height: e.target.value })} placeholder="178" />
              </Field>
              <Field label="Peso (kg)">
                <TextInput inputMode="numeric" value={calc.weight} onChange={(e) => setCalc({ ...calc, weight: e.target.value })} placeholder="80" />
              </Field>
            </div>
            <Field label="Livello di attività">
              <Select value={calc.activity} onChange={(e) => setCalc({ ...calc, activity: e.target.value as Activity })}>
                {(Object.keys(ACTIVITY) as Activity[]).map((k) => (
                  <option key={k} value={k}>
                    {ACTIVITY[k].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Obiettivo">
              <Select value={calc.objective} onChange={(e) => setCalc({ ...calc, objective: e.target.value as Objective })}>
                {(Object.keys(OBJECTIVE) as Objective[]).map((k) => (
                  <option key={k} value={k}>
                    {OBJECTIVE[k].label}
                  </option>
                ))}
              </Select>
            </Field>
            {suggestion ? (
              <div className="rounded-2xl bg-surface2 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="num text-4xl font-semibold">{fmtNum(suggestion.kcal, 0)}</span>
                  <span className="text-muted">kcal al giorno</span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  Proteine {suggestion.proteinG} g, carboidrati {suggestion.carbsG} g, grassi {suggestion.fatG} g, acqua {fmtNum(suggestion.waterMl / 1000, 2)} L
                </p>
                <Button
                  className="mt-3 w-full"
                  onClick={() => {
                    setF({ kcal: String(suggestion.kcal), protein: String(suggestion.proteinG), carbs: String(suggestion.carbsG), fat: String(suggestion.fatG), water: String(suggestion.waterMl) });
                    setSaved(false);
                    setOpen(false);
                  }}
                >
                  Usa questi valori
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted">Inserisci età, altezza e peso per vedere la stima.</p>
            )}
            <p className="text-xs text-muted">Stima orientativa (formula di Mifflin-St Jeor). Non sostituisce il parere di un medico o di un nutrizionista.</p>
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="num text-2xl font-semibold">I tuoi obiettivi giornalieri</h2>
        <Field label="Calorie (kcal)">
          <TextInput inputMode="numeric" value={f.kcal} onChange={(e) => set("kcal", e.target.value)} placeholder="2200" />
        </Field>
        {kcal > 0 && (
          <div>
            <div className="mb-1.5 text-sm font-medium text-muted">Ripartisci i macronutrienti</div>
            <div className="flex flex-wrap gap-2">
              {SPLIT_PRESETS.map((pr) => (
                <button
                  key={pr.label}
                  type="button"
                  onClick={() => {
                    const s = splitByPercent(kcal, pr);
                    setF((x) => ({ ...x, protein: String(s.proteinG), carbs: String(s.carbsG), fat: String(s.fatG) }));
                    setSaved(false);
                  }}
                  className="h-10 rounded-full bg-surface2 px-4 text-sm font-semibold"
                >
                  {pr.label} {pr.protein}/{pr.carbs}/{pr.fat}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Proteine (g)">
            <TextInput inputMode="numeric" value={f.protein} onChange={(e) => set("protein", e.target.value)} />
          </Field>
          <Field label="Carboidrati (g)">
            <TextInput inputMode="numeric" value={f.carbs} onChange={(e) => set("carbs", e.target.value)} />
          </Field>
          <Field label="Grassi (g)">
            <TextInput inputMode="numeric" value={f.fat} onChange={(e) => set("fat", e.target.value)} />
          </Field>
        </div>
        {kcal > 0 && (p > 0 || c > 0 || g > 0) && (
          <p className="text-sm text-muted">
            I macronutrienti corrispondono a {fmtNum(kcalFromMacros(p, c, g), 0)} kcal
            {Math.abs(mismatch) > 5 ? `, ${Math.abs(mismatch)}% ${mismatch > 0 ? "in più" : "in meno"} dell'obiettivo.` : ", in linea con l'obiettivo."}
          </p>
        )}
        <Field label="Acqua (ml al giorno)">
          <TextInput inputMode="numeric" value={f.water} onChange={(e) => set("water", e.target.value)} />
        </Field>
        <FormError message={error} />
        <Button size="lg" className="w-full" onClick={save} disabled={busy || kcal <= 0}>
          {saved ? (
            <>
              <Icon name="check" size={18} /> Salvato
            </>
          ) : (
            "Salva obiettivi"
          )}
        </Button>
        {saved && (
          <Link href="/diet" className="block text-center font-semibold underline underline-offset-4">
            Vai al diario di oggi
          </Link>
        )}
      </Card>
    </div>
  );
}
