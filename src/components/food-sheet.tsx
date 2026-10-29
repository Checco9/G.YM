"use client";

import { useEffect, useMemo, useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { addFoodLocal, loadFoods, normalize } from "@/lib/food-library";
import { fmtNum } from "@/lib/format";
import { describeIssues, type ProductIssue, type ScannedProduct } from "@/modules/diet/barcode/domain";
import { MEALS, scale, type Meal } from "@/modules/diet/domain/nutrition";
import type { LookupResult } from "@/modules/diet/barcode/service";
import type { EntryView, FoodItem, RecentFood } from "@/modules/diet/service";
import { BarcodeScanner } from "./barcode-scanner";
import { FoodForm, type FoodPrefill, type MissingKey } from "./food-form";
import { Button, IconButton } from "./ui/button";
import { Field, FormError, TextInput } from "./ui/field";
import { Icon } from "./ui/icons";
import { Sheet } from "./ui/sheet";

/** Origine di un alimento arrivato da una scansione: serve a salvarlo (o meno) alla conferma. */
type Scanned = { barcode: string; fromOff: boolean; persisted: boolean; kcalEstimated: boolean };

type Step =
  | { kind: "list" }
  | { kind: "quantity"; food: FoodItem; scanned?: Scanned }
  | { kind: "create"; prefill?: FoodPrefill; barcode?: string; fromOff?: boolean; notice?: string; missing?: MissingKey[] }
  | { kind: "quick" }
  | { kind: "scan" }
  | { kind: "lookup"; code: string }
  | { kind: "notfound"; code: string; reason: "missing" | "error"; message?: string };

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
    barcode: null,
    isCustom: false,
  };
}

/** Prodotto completo di Open Food Facts -> alimento pronto da usare (non ancora salvato). */
function foodFromProduct(p: ScannedProduct): FoodItem {
  return {
    id: `scan:${p.barcode}`,
    name: p.name!,
    brand: p.brand,
    category: "Open Food Facts",
    unit: p.unit,
    kcal: p.kcal!,
    protein: p.protein!,
    carbs: p.carbs!,
    fat: p.fat!,
    servingSize: p.servingSize,
    servingLabel: p.servingLabel,
    barcode: p.barcode,
    isCustom: true,
  };
}

const ISSUE_KEY: Partial<Record<ProductIssue, MissingKey>> = { no_name: "name", no_kcal: "kcal", no_protein: "protein", no_carbs: "carbs", no_fat: "fat" };

function reviewNotice(p: ScannedProduct): string {
  const parts: string[] = [];
  const missing = describeIssues(p.issues);
  if (missing) parts.push(`Nel database mancano ${missing}.`);
  if (p.issues.includes("inconsistent")) parts.push("Alcuni valori non sembrano coerenti tra loro.");
  return `${parts.join(" ")} Controlla e completa i dati con l'etichetta del prodotto.`;
}

export function FoodSheet({
  meal,
  date,
  recents,
  startScan = false,
  onAdded,
  onClose,
}: {
  meal: Meal;
  date: string;
  recents: RecentFood[];
  startScan?: boolean;
  onAdded: (e: EntryView) => void;
  onClose: () => void;
}) {
  const mealLabel = MEALS.find((m) => m.key === meal)!.label;
  const [step, setStep] = useState<Step>(startScan ? { kind: "scan" } : { kind: "list" });
  const [foods, setFoods] = useState<FoodItem[] | null>(null);
  const [q, setQ] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFoods().then(setFoods).catch(() => setError("Impossibile caricare gli alimenti. Controlla la connessione."));
  }, []);

  // Ricerca del prodotto dopo la scansione: prima i tuoi alimenti, poi Open Food Facts.
  useEffect(() => {
    if (step.kind !== "lookup") return;
    let cancelled = false;
    const code = step.code;
    call<LookupResult>("GET", `/api/barcode/${code}`)
      .then((r) => {
        if (cancelled) return;
        if (r.source === "own") {
          setStep({ kind: "quantity", food: r.food, scanned: { barcode: code, fromOff: r.food.category === "Open Food Facts", persisted: true, kcalEstimated: false } });
          return;
        }
        const p = r.product;
        if (p.complete) {
          setStep({ kind: "quantity", food: foodFromProduct(p), scanned: { barcode: p.barcode, fromOff: true, persisted: false, kcalEstimated: p.issues.includes("kcal_estimated") } });
        } else {
          setStep({
            kind: "create",
            prefill: p,
            barcode: p.barcode,
            fromOff: true,
            notice: reviewNotice(p),
            missing: p.issues.map((i) => ISSUE_KEY[i]).filter((k): k is MissingKey => Boolean(k)),
          });
        }
      })
      .catch((e) => {
        if (cancelled) return;
        const notFound = e instanceof ApiError && e.status === 404;
        setStep({ kind: "notfound", code, reason: notFound ? "missing" : "error", message: notFound ? undefined : e instanceof ApiError ? e.message : "Servizio dei prodotti non raggiungibile." });
      });
    return () => {
      cancelled = true;
    };
  }, [step]);

  const results = useMemo(() => {
    if (!foods) return [];
    const tokens = normalize(q).split(/\s+/).filter(Boolean);
    const list = tokens.length ? foods.filter((f) => tokens.every((t) => normalize(`${f.name} ${f.brand ?? ""} ${f.category ?? ""}`).includes(t))) : foods;
    return list.slice(0, 50);
  }, [foods, q]);

  const finishAdd = (entry: EntryView, label: string) => {
    onAdded(entry);
    setAdded((a) => [...a, label]);
    setStep({ kind: "list" });
    setQ("");
  };

  async function add(body: Record<string, unknown>, label: string) {
    setBusy(true);
    setError(null);
    try {
      finishAdd(await call<EntryView>("POST", "/api/diet/entries", { date, meal, ...body }), label);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Si è verificato un errore. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  /** Prodotto scansionato non ancora salvato: lo si salva tra i tuoi alimenti (con il codice) e poi lo si aggiunge al diario. */
  async function addScanned(food: FoodItem, scanned: Scanned, quantity: number) {
    setBusy(true);
    setError(null);
    try {
      const saved = await call<FoodItem>("POST", "/api/foods", {
        name: food.name,
        brand: food.brand,
        unit: food.unit,
        kcal: food.kcal,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        servingSize: food.servingSize,
        servingLabel: food.servingLabel,
        barcode: scanned.barcode,
        fromOpenFoodFacts: scanned.fromOff,
      });
      addFoodLocal(saved);
      setFoods((l) => (l ? [saved, ...l.filter((x) => x.id !== saved.id)] : l));
      finishAdd(await call<EntryView>("POST", "/api/diet/entries", { date, meal, foodId: saved.id, quantity }), saved.name);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Si è verificato un errore. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  const backToList = () => {
    setError(null);
    setStep({ kind: "list" });
  };

  const done = (
    <Button className="w-full" onClick={onClose}>
      {added.length ? `Fatto, ${added.length} ${added.length === 1 ? "aggiunto" : "aggiunti"}` : "Chiudi"}
    </Button>
  );

  // ───────── Scansione ─────────
  if (step.kind === "scan")
    return (
      <Sheet
        title="Scansiona prodotto"
        onClose={onClose}
        footer={
          <Button variant="secondary" className="w-full" onClick={backToList}>
            Cerca per nome
          </Button>
        }
      >
        <BarcodeScanner onDetected={(code) => setStep({ kind: "lookup", code })} />
      </Sheet>
    );

  if (step.kind === "lookup")
    return (
      <Sheet
        title="Cerco il prodotto"
        onClose={onClose}
        footer={
          <Button variant="secondary" className="w-full" onClick={() => setStep({ kind: "scan" })}>
            Annulla
          </Button>
        }
      >
        <div role="status" className="flex flex-col items-center gap-4 py-10 text-center">
          <span className="plate-spin text-fg">
            <Icon name="search" size={36} />
          </span>
          <div>
            <div className="num text-2xl font-semibold">Ricerca in corso</div>
            <div className="mt-1 text-sm text-muted">Codice {step.code}</div>
          </div>
        </div>
      </Sheet>
    );

  if (step.kind === "notfound") {
    const failed = step.reason === "error";
    return (
      <Sheet title={failed ? "Servizio non raggiungibile" : "Prodotto non trovato"} onClose={onClose}>
        <p className="text-muted">
          {failed ? step.message : "Questo codice non è nel database dei prodotti."} <span className="num text-fg">{step.code}</span>
        </p>
        <div className="mt-5 flex flex-col gap-2">
          {failed && (
            <Button icon="search" onClick={() => setStep({ kind: "lookup", code: step.code })}>
              Riprova
            </Button>
          )}
          <Button variant={failed ? "secondary" : "primary"} icon="plus" onClick={() => setStep({ kind: "create", barcode: step.code, notice: "Inserisci i valori riportati sull'etichetta: la prossima volta che scansionerai questo prodotto lo troverai subito." })}>
            Inserisci i valori a mano
          </Button>
          <Button variant="secondary" icon="search" onClick={backToList}>
            Cerca per nome
          </Button>
          <Button variant="ghost" icon="camera" onClick={() => setStep({ kind: "scan" })}>
            Scansiona di nuovo
          </Button>
        </div>
      </Sheet>
    );
  }

  // ───────── Creazione / controllo dati ─────────
  if (step.kind === "create")
    return (
      <Sheet title={step.prefill ? "Controlla i dati" : "Nuovo alimento"} onClose={onClose}>
        <FoodForm
          prefill={step.prefill}
          barcode={step.barcode}
          fromOff={step.fromOff}
          notice={step.notice}
          missing={step.missing}
          onCancel={backToList}
          onSaved={(f) => {
            addFoodLocal(f);
            setFoods((l) => (l ? [f, ...l.filter((x) => x.id !== f.id)] : l));
            setStep({ kind: "quantity", food: f, scanned: step.barcode ? { barcode: step.barcode, fromOff: Boolean(step.fromOff), persisted: true, kcalEstimated: false } : undefined });
          }}
        />
      </Sheet>
    );

  if (step.kind === "quick")
    return <QuickAdd mealLabel={mealLabel} busy={busy} error={error} onBack={backToList} onClose={onClose} onAdd={(m) => add({ manual: m, quantity: 1 }, m.name)} />;

  if (step.kind === "quantity") {
    const s = step.scanned;
    return (
      <Quantity
        food={step.food}
        mealLabel={mealLabel}
        busy={busy}
        error={error}
        source={s?.fromOff ? "Dati da Open Food Facts (licenza ODbL)" : undefined}
        note={s?.kcalEstimated ? "Calorie calcolate dai macronutrienti: nel database mancava il valore." : undefined}
        onBack={backToList}
        onClose={onClose}
        onAdd={(qty) => (s && !s.persisted ? addScanned(step.food, s, qty) : add({ foodId: step.food.id, quantity: qty }, step.food.name))}
      />
    );
  }

  // ───────── Elenco ─────────
  return (
    <Sheet title={`Aggiungi a ${mealLabel.toLowerCase()}`} onClose={onClose} footer={done}>
      {added.length > 0 && (
        <p role="status" className="mb-3 flex items-center gap-2 rounded-xl bg-surface2 px-4 py-2.5 text-sm font-semibold">
          <Icon name="check" size={16} />
          Aggiunto: {added[added.length - 1]}
        </p>
      )}
      <Button className="mb-3 w-full" icon="camera" onClick={() => setStep({ kind: "scan" })}>
        Scansiona prodotto
      </Button>
      <TextInput placeholder="Cerca un alimento" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca un alimento" autoFocus={!startScan} />
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
        {foods && results.length === 0 && <p className="py-6 text-center text-muted">Nessun risultato per “{q}”. Puoi creare l'alimento, scansionarne il codice o usare l'aggiunta veloce.</p>}
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
  source,
  note,
  onBack,
  onClose,
  onAdd,
}: {
  food: FoodItem;
  mealLabel: string;
  busy: boolean;
  error: string | null;
  source?: string;
  note?: string;
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
            {busy ? "Salvataggio…" : `Aggiungi a ${mealLabel.toLowerCase()}`}
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
        <p className="mt-3 border-t border-line pt-2 text-xs text-muted">
          Per 100 {food.unit}: {fmtNum(food.kcal, 0)} kcal, proteine {fmtNum(food.protein)} g, carboidrati {fmtNum(food.carbs)} g, grassi {fmtNum(food.fat)} g
        </p>
      </div>
      {note && <p className="mt-3 text-sm text-muted">{note}</p>}
      {source && <p className="mt-1 text-xs text-muted">{source}</p>}
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
