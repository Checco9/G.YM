"use client";

import { useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { kcalFromMacros } from "@/modules/diet/domain/nutrition";
import type { FoodItem } from "@/modules/diet/service";
import { Button } from "./ui/button";
import { Field, FormError, Select, TextInput } from "./ui/field";

const num = (s: string) => {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

/** Crea o modifica un alimento personale. I valori sono per 100 g (o 100 ml). */
export function FoodForm({ initial, onSaved, onCancel }: { initial?: FoodItem; onSaved: (f: FoodItem) => void; onCancel: () => void }) {
  const [f, setF] = useState({
    name: initial?.name ?? "",
    brand: initial?.brand ?? "",
    unit: initial?.unit ?? "g",
    kcal: initial ? String(initial.kcal) : "",
    protein: initial ? String(initial.protein) : "",
    carbs: initial ? String(initial.carbs) : "",
    fat: initial ? String(initial.fat) : "",
    servingSize: initial?.servingSize ? String(initial.servingSize) : "",
    servingLabel: initial?.servingLabel ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const [k, p, c, g] = [num(f.kcal), num(f.protein), num(f.carbs), num(f.fat)];
  const calc = [p, c, g].every(Number.isFinite) ? kcalFromMacros(p, c, g) : null;
  const mismatch = Number.isFinite(k) && calc !== null && Math.abs(k - calc) > Math.max(20, calc * 0.2);

  async function save() {
    setBusy(true);
    setError(null);
    const body = {
      name: f.name,
      brand: f.brand || null,
      unit: f.unit,
      kcal: k,
      protein: p,
      carbs: c,
      fat: g,
      servingSize: f.servingSize ? num(f.servingSize) : null,
      servingLabel: f.servingLabel || null,
    };
    try {
      const saved = initial ? await call<FoodItem>("PUT", `/api/foods/${initial.id}`, body) : await call<FoodItem>("POST", "/api/foods", body);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Errore");
      setBusy(false);
    }
  }

  const unit = f.unit === "ml" ? "100 ml" : "100 g";
  return (
    <div className="space-y-4">
      <Field label="Nome">
        <TextInput value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={80} placeholder="Yogurt proteico" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Marca (facoltativa)">
          <TextInput value={f.brand} onChange={(e) => set("brand", e.target.value)} maxLength={40} />
        </Field>
        <Field label="Valori riferiti a">
          <Select value={f.unit} onChange={(e) => set("unit", e.target.value)}>
            <option value="g">100 g</option>
            <option value="ml">100 ml</option>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Calorie per ${unit}`}>
          <TextInput inputMode="decimal" value={f.kcal} onChange={(e) => set("kcal", e.target.value)} placeholder="kcal" />
        </Field>
        <Field label="Proteine (g)">
          <TextInput inputMode="decimal" value={f.protein} onChange={(e) => set("protein", e.target.value)} />
        </Field>
        <Field label="Carboidrati (g)">
          <TextInput inputMode="decimal" value={f.carbs} onChange={(e) => set("carbs", e.target.value)} />
        </Field>
        <Field label="Grassi (g)">
          <TextInput inputMode="decimal" value={f.fat} onChange={(e) => set("fat", e.target.value)} />
        </Field>
      </div>
      {mismatch && <p className="rounded-xl bg-surface2 px-4 py-3 text-sm text-muted">Con questi macronutrienti le calorie sarebbero circa {calc}. Controlla i valori sull'etichetta.</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Porzione (g o ml)" hint="Facoltativa">
          <TextInput inputMode="decimal" value={f.servingSize} onChange={(e) => set("servingSize", e.target.value)} placeholder="125" />
        </Field>
        <Field label="Nome porzione" hint="Es. 1 vasetto">
          <TextInput value={f.servingLabel} onChange={(e) => set("servingLabel", e.target.value)} maxLength={30} />
        </Field>
      </div>
      <FormError message={error} />
      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          Annulla
        </Button>
        <Button className="flex-1" onClick={save} disabled={busy}>
          {initial ? "Salva" : "Crea alimento"}
        </Button>
      </div>
    </div>
  );
}
