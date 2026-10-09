"use client";

import { useEffect, useMemo, useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { addFoodLocal, loadFoods, normalize } from "@/lib/food-library";
import { fmtNum } from "@/lib/format";
import { MEALS, scale, type Meal } from "@/modules/diet/domain/nutrition";
import type { EntryView, FoodItem, RecentFood } from "@/modules/diet/service";
import { Button, IconButton } from "./ui/button";
import { Field, FormError, TextInput } from "./ui/field";
import { Icon } from "./ui/icons";
import { Sheet } from "./ui/sheet";
import { FoodForm } from "./food-form";

type Step = { kind: "list" } | { kind: "quantity"; food: FoodItem } | { kind: "create" } | { kind: "quick" };

const num = (s: string) => {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Ricostruisce i valori per 100 g da un elemento recente, senza dover aspettare il catalogo. */
function foodFromRecent(r: RecentFood): FoodItem {
  const k = r.quantity > 0 ? 100 / r.quantity : 0;
  return {
    id: r.foodId!,
    name: r.name,
    brand: null,
    category: null,
    unit: r.unit === "ml" ? "ml" : "g",
    kcal: Math.round(r.kcal * k * 10) / 10,
    protein: Math.round(r.protein * k * 10) / 10,
    carbs: Math.round(r.carbs * k * 10) / 10,
    fat: Math.round(r.fat * k * 10) / 10,
    servingSize: null,
    servingLabel: null,
    isCustom: false,
  };
}

export function FoodSheet({
  meal,
  date,
  recents,
  onAdded,
  onClose,
}: {
  meal: Meal;
  date: string;
  recents: RecentFood[];
  onAdded: (e: EntryView) => void;
  onClose: () => void;
}) {
  const mealLabel = MEALS.find((m) => m.key === meal)!.label;
  const [step, setStep] = useState<Step>({ kind: "list" });
  const [foods, setFoods] = useState<FoodItem[] | null>(null);
  const [q, setQ] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFoods().then(setFoods).catch(() => setError("Impossibile caricare gli alimenti. Controlla la connessione."));
  }, []);

  const results = useMemo(() => {
    if (!foods) return [];
    const tokens = normalize(q).split(/\s+/).filter(Boolean);
    const list = tokens.length ? foods.filter((f) => tokens.every((t) => normalize(`${f.name} ${f.brand ?? ""} ${f.category ?? ""}`).includes(t))) : foods;
    return list.slice(0, 50);
  }, [foods, q]);

  async function add(body: Record<string, unknown>, label: string) {
    setBusy(true);
    setError(null);
    try {
      const entry = await call<EntryView>("POST", "/api/diet/entries", { date, meal, ...body });
      onAdded(entry);
      setAdded((a) => [...a, label]);
      setStep({ kind: "list" });
      setQ("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Errore");
    } finally {
      setBusy(false);
    }
  }

  const done = (
    <Button className="w-full" onClick={onClose}>
      {added.length ? `Fatto, ${added.length} ${added.length === 1 ? "aggiunto" : "aggiunti"}` : "Chiudi"}
    </Button>
  );

  if (step.kind === "create")
    return (
      <Sheet title="Nuovo alimento" onClose={onClose}>
        <FoodForm
          onCancel={() => setStep({ kind: "list" })}
          onSaved={(f) => {
            addFoodLocal(f);
            setFoods((l) => (l ? [f, ...l] : l));
            setStep({ kind: "quantity", food: f });
          }}
        />
      </Sheet>
    );

  if (step.kind === "quick") return <QuickAdd mealLabel={mealLabel} busy={busy} error={error} onBack={() => setStep({ kind: "list" })} onClose={onClose} onAdd={(m) => add({ manual: m, quantity: 1 }, m.name)} />;

  if (step.kind === "quantity")
    return <Quantity food={step.food} mealLabel={mealLabel} busy={busy} error={error} onBack={() => setStep({ kind: "list" })} onClose={onClose} onAdd={(qty) => add({ foodId: step.food.id, quantity: qty }, step.food.name)} />;

  return (
    <Sheet title={`Aggiungi a ${mealLabel.toLowerCase()}`} onClose={onClose} footer={done}>
      {added.length > 0 && (
        <p role="status" className="mb-3 flex items-center gap-2 rounded-xl bg-surface2 px-4 py-2.5 text-sm font-semibold">
          <Icon name="check" size={16} />
          Aggiunto: {added[added.length - 1]}
        </p>
      )}
      <TextInput placeholder="Cerca un alimento" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca un alimento" autoFocus />
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" size="sm" icon="plus" className="flex-1" onClick={() => setStep({ kind: "create" })}>
          Crea alimento
        </Button>
        <Button variant="secondary" size="sm" className="flex-1" onClick={() => setStep({ kind: "quick" })}>
          Aggiunta veloce
        </Button>
      </div>
      <FormError message={error} />

      {!q && recents.length > 0 && (
        <section className="mt-4">
          <h3 className="mb-1 text-sm font-medium text-muted">Recenti</h3>
          <ul className="divide-y divide-line">
            {recents.map((r) => (
              <li key={r.foodId} className="flex items-center gap-2">
                <button type="button" className="min-h-14 min-w-0 flex-1 py-2 text-left" onClick={() => setStep({ kind: "quantity", food: foodFromRecent(r) })}>
                  <div className="truncate text-[17px] font-medium">{r.name}</div>
                  <div className="text-sm text-muted">
                    {fmtNum(r.quantity, 0)} {r.unit === "porzione" ? "porz." : r.unit}, {fmtNum(r.kcal, 0)} kcal
                  </div>
                </button>
                <IconButton icon="plus" label={`Aggiungi di nuovo ${r.name}`} disabled={busy} onClick={() => add({ foodId: r.foodId, quantity: r.quantity }, r.name)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-4">
        <h3 className="mb-1 text-sm font-medium text-muted">{q ? "Risultati" : "Alimenti"}</h3>
        {!foods && !error && <p className="py-6 text-center text-muted">Caricamento degli alimenti…</p>}
        <ul className="divide-y divide-line">
          {results.map((f) => (
            <li key={f.id}>
              <button type="button" className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left" onClick={() => setStep({ kind: "quantity", food: f })}>
                <div className="min-w-0">
                  <div className="truncate text-[17px] font-medium">
                    {f.name}
                    {f.brand && <span className="font-normal text-muted"> ({f.brand})</span>}
                  </div>
                  <div className="text-sm text-muted">
                    {fmtNum(f.kcal, 0)} kcal per 100 {f.unit}
                  </div>
                </div>
                {f.isCustom && <span className="shrink-0 rounded-full bg-surface2 px-2.5 py-0.5 text-xs text-muted">Personale</span>}
              </button>
            </li>
          ))}
        </ul>
        {foods && results.length === 0 && (
          <p className="py-6 text-center text-muted">
            Nessun risultato per “{q}”. Puoi creare l'alimento o usare l'aggiunta veloce.
          </p>
        )}
        {foods && !q && foods.length > 50 && <p className="py-3 text-center text-sm text-muted">Scrivi il nome per cercare tra tutti gli alimenti.</p>}
      </section>
    </Sheet>
  );
}

function Quantity({
  food,
  mealLabel,
  busy,
  error,
  onBack,
  onClose,
  onAdd,
}: {
  food: FoodItem;
  mealLabel: string;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onClose: () => void;
  onAdd: (quantity: number) => void;
}) {
  const hasServing = Boolean(food.servingSize);
  const [mode, setMode] = useState<"base" | "serving">(hasServing ? "serving" : "base");
  const [value, setValue] = useState(hasServing ? "1" : "100");
  const qty = mode === "serving" ? num(value) * (food.servingSize ?? 0) : num(value);
  const n = scale(food, qty);
  const step = mode === "serving" ? 0.5 : food.unit === "ml" ? 50 : 10;

  function bump(d: number) {
    const next = Math.max(0, Math.round((num(value) + d) * 100) / 100);
    setValue(String(next).replace(".", ","));
  }

  return (
    <Sheet
      title={food.name}
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onBack}>
            Indietro
          </Button>
          <Button className="flex-1" disabled={busy || qty <= 0} onClick={() => onAdd(Math.round(qty * 10) / 10)}>
            Aggiungi a {mealLabel.toLowerCase()}
          </Button>
        </div>
      }
    >
      {food.brand && <p className="-mt-1 mb-3 text-muted">{food.brand}</p>}
      {hasServing && (
        <div role="tablist" aria-label="Unità" className="mb-4 grid grid-cols-2 rounded-full bg-surface2 p-1">
          {(
            [
              ["serving", food.servingLabel ? `Porzioni (${food.servingLabel})` : "Porzioni"],
              ["base", food.unit === "ml" ? "Millilitri" : "Grammi"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={mode === k}
              onClick={() => {
                setMode(k);
                setValue(k === "serving" ? "1" : String(food.servingSize));
              }}
              className={`h-10 truncate rounded-full px-2 text-sm font-semibold ${mode === k ? "bg-fg text-onfg" : "text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <Field label={mode === "serving" ? "Numero di porzioni" : food.unit === "ml" ? "Quantità (ml)" : "Quantità (g)"}>
        <div className="flex items-center gap-2">
          <IconButton icon="minus" label="Diminuisci" onClick={() => bump(-step)} className="bg-surface2" />
          <input
            inputMode="decimal"
            value={value}
            onChange={(e) => /^\d{0,5}([.,]\d{0,2})?$/.test(e.target.value) && setValue(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Quantità"
            className="num h-14 min-w-0 flex-1 rounded-xl bg-surface2 text-center text-[32px] font-semibold outline-none ring-1 ring-transparent focus:ring-fg"
          />
          <IconButton icon="plus" label="Aumenta" onClick={() => bump(step)} className="bg-surface2" />
        </div>
        {mode === "serving" && qty > 0 && (
          <span className="mt-1 block text-sm text-muted">
            {fmtNum(qty, 0)} {food.unit}
          </span>
        )}
      </Field>

      <div className="mt-5 rounded-2xl bg-surface2 p-4">
        <div className="flex items-baseline justify-between">
          <span className="num text-4xl font-semibold">{fmtNum(n.kcal, 0)}</span>
          <span className="text-muted">kcal</span>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {(
            [
              ["Proteine", n.protein],
              ["Carboidrati", n.carbs],
              ["Grassi", n.fat],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dd className="num text-2xl font-semibold leading-none">{fmtNum(v)} g</dd>
              <dt className="mt-0.5 text-xs text-muted">{k}</dt>
            </div>
          ))}
        </dl>
      </div>
      <div className="mt-3">
        <FormError message={error} />
      </div>
    </Sheet>
  );
}

function QuickAdd({
  mealLabel,
  busy,
  error,
  onBack,
  onClose,
  onAdd,
}: {
  mealLabel: string;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onClose: () => void;
  onAdd: (m: { name: string; kcal: number; protein: number; carbs: number; fat: number }) => void;
}) {
  const [f, setF] = useState({ name: "", kcal: "", protein: "", carbs: "", fat: "" });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const valid = f.name.trim().length > 0 && num(f.kcal) > 0;
  return (
    <Sheet
      title="Aggiunta veloce"
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onBack}>
            Indietro
          </Button>
          <Button className="flex-1" disabled={busy || !valid} onClick={() => onAdd({ name: f.name.trim(), kcal: num(f.kcal), protein: num(f.protein), carbs: num(f.carbs), fat: num(f.fat) })}>
            Aggiungi a {mealLabel.toLowerCase()}
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-muted">Per un piatto del ristorante o un prodotto che non trovi: inserisci i valori dell'intera porzione.</p>
      <div className="space-y-3">
        <Field label="Nome">
          <TextInput value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={80} placeholder="Pizza al ristorante" autoFocus />
        </Field>
        <Field label="Calorie (kcal)">
          <TextInput inputMode="decimal" value={f.kcal} onChange={(e) => set("kcal", e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Proteine (g)">
            <TextInput inputMode="decimal" value={f.protein} onChange={(e) => set("protein", e.target.value)} />
          </Field>
          <Field label="Carbo (g)">
            <TextInput inputMode="decimal" value={f.carbs} onChange={(e) => set("carbs", e.target.value)} />
          </Field>
          <Field label="Grassi (g)">
            <TextInput inputMode="decimal" value={f.fat} onChange={(e) => set("fat", e.target.value)} />
          </Field>
        </div>
        <FormError message={error} />
      </div>
    </Sheet>
  );
}
