"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { addDaysToKey } from "@/lib/dates";
import { loadFoods } from "@/lib/food-library";
import { fmtNum } from "@/lib/format";
import { MEALS, addUp, dayProgress, rescale, type Goals, type Meal } from "@/modules/diet/domain/nutrition";
import type { EntryView, RecentFood } from "@/modules/diet/service";
import { CalorieRing } from "./calorie-ring";
import { FoodSheet } from "./food-sheet";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { FormError } from "./ui/field";
import { ProgressBar } from "./ui/progress";
import { Sheet } from "./ui/sheet";

const num = (s: string) => {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const qtyLabel = (e: EntryView) => (e.unit === "porzione" ? `${fmtNum(e.quantity)} ${e.quantity === 1 ? "porzione" : "porzioni"}` : `${fmtNum(e.quantity, e.quantity % 1 ? 1 : 0)} ${e.unit}`);

export function DietDay({
  date,
  initialEntries,
  initialWater,
  goals,
  recents,
}: {
  date: string;
  initialEntries: EntryView[];
  initialWater: number;
  goals: Goals | null;
  recents: RecentFood[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [water, setWater] = useState(initialWater);
  const [adding, setAdding] = useState<Meal | null>(null);
  const [editing, setEditing] = useState<EntryView | null>(null);
  const [waterSheet, setWaterSheet] = useState(false);
  const [notice, setNotice] = useState<Record<string, string>>({});

  // Gli alimenti si scaricano in background: quando apri il selettore sono già pronti.
  useEffect(() => {
    void loadFoods().catch(() => {});
  }, []);

  const total = useMemo(() => addUp(entries), [entries]);
  const progress = dayProgress(total, goals);
  const waterGoal = goals?.waterMl ?? 2000;

  async function addWater(delta: number) {
    const before = water;
    setWater(Math.max(0, Math.min(10000, before + delta)));
    try {
      const r = await call<{ ml: number }>("PUT", "/api/diet/water", { date, delta });
      setWater(r.ml);
    } catch {
      setWater(before);
    }
  }

  async function copyMeal(meal: Meal) {
    setNotice((n) => ({ ...n, [meal]: "" }));
    try {
      const r = await call<{ entries: EntryView[] }>("POST", "/api/diet/entries/copy", { fromDate: addDaysToKey(date, -1), toDate: date, meal });
      if (!r.entries.length) setNotice((n) => ({ ...n, [meal]: "Ieri non c'è niente da copiare" }));
      setEntries((e) => [...e, ...r.entries]);
    } catch (e) {
      setNotice((n) => ({ ...n, [meal]: e instanceof ApiError ? e.message : "Errore" }));
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:items-start">
      <div className="space-y-4 md:sticky md:top-6">
        <Card>
          {progress && goals ? (
            <>
              <CalorieRing consumed={total.kcal} goal={goals.kcal} percent={progress.kcalPercent} over={progress.over} />
              <div className="mt-4 grid grid-cols-2 text-center">
                <div>
                  <div className="num text-3xl font-semibold">{fmtNum(total.kcal, 0)}</div>
                  <div className="text-sm text-muted">Assunte</div>
                </div>
                <div>
                  <div className="num text-3xl font-semibold">{fmtNum(goals.kcal, 0)}</div>
                  <div className="text-sm text-muted">Obiettivo</div>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {progress.macros.map((m) => (
                  <div key={m.key}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="font-semibold">{m.label}</span>
                      <span className="num text-lg">
                        {m.value} <span className="text-muted">/ {m.goal} g</span>
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuenow={m.percent} aria-valuemin={0} aria-valuemax={100} aria-label={m.label}>
                      <div className={`h-full rounded-full transition-[width] duration-500 ${m.over ? "bg-danger" : "bg-fg"}`} style={{ width: `${m.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm text-muted">Assunte oggi</div>
              <div className="num text-6xl font-bold leading-none">{fmtNum(total.kcal, 0)}<span className="ml-2 text-2xl font-medium text-muted">kcal</span></div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                {([["Proteine", total.protein], ["Carboidrati", total.carbs], ["Grassi", total.fat]] as const).map(([k, v]) => (
                  <div key={k}>
                    <dd className="num text-2xl font-semibold leading-none">{fmtNum(v, 0)} g</dd>
                    <dt className="mt-0.5 text-xs text-muted">{k}</dt>
                  </div>
                ))}
              </dl>
              <Link href="/diet/goals" className="mt-5 flex h-12 items-center justify-center rounded-2xl bg-fg font-semibold text-onfg">
                Imposta i tuoi obiettivi
              </Link>
            </>
          )}
        </Card>

        <Card>
          <div className="flex items-baseline justify-between">
            <h2 className="num text-2xl font-semibold">Acqua</h2>
            <span className="num text-xl">
              {fmtNum(water / 1000, 2)} <span className="text-muted">/ {fmtNum(waterGoal / 1000, 2)} L</span>
            </span>
          </div>
          <ProgressBar percent={Math.min(100, Math.round((water / waterGoal) * 100))} className="mt-3" />
          <div className="mt-4 grid grid-cols-4 gap-2">
            {[150, 250, 500].map((ml) => (
              <Button key={ml} variant="secondary" size="sm" onClick={() => addWater(ml)} aria-label={`Aggiungi ${ml} millilitri`}>
                +{ml}
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setWaterSheet(true)} aria-label="Altra quantità di acqua">
              Altro
            </Button>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        {MEALS.map((m) => {
          const items = entries.filter((e) => e.meal === m.key);
          const kcal = Math.round(items.reduce((n, e) => n + e.kcal, 0));
          return (
            <Card key={m.key} className="p-4 md:p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="num text-2xl font-semibold">{m.label}</h2>
                <span className="num text-xl text-muted">{kcal > 0 ? `${fmtNum(kcal, 0)} kcal` : ""}</span>
              </div>
              {items.length > 0 && (
                <ul className="mt-2 divide-y divide-line">
                  {items.map((e) => (
                    <li key={e.id}>
                      <button type="button" onClick={() => setEditing(e)} className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left" aria-label={`Modifica ${e.name}`}>
                        <div className="min-w-0">
                          <div className="truncate text-[17px] font-medium">{e.name}</div>
                          <div className="text-sm text-muted">{qtyLabel(e)}</div>
                        </div>
                        <span className="num shrink-0 text-xl">{fmtNum(e.kcal, 0)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" size="sm" icon="plus" className="flex-1" onClick={() => setAdding(m.key)}>
                  Aggiungi alimento
                </Button>
                {items.length === 0 && (
                  <Button variant="ghost" size="sm" onClick={() => copyMeal(m.key)}>
                    Copia da ieri
                  </Button>
                )}
              </div>
              {notice[m.key] && <p className="mt-2 text-sm text-muted">{notice[m.key]}</p>}
            </Card>
          );
        })}
      </div>

      {adding && <FoodSheet meal={adding} date={date} recents={recents} onClose={() => setAdding(null)} onAdded={(e) => setEntries((l) => [...l, e])} />}
      {editing && (
        <EditEntry
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={(e) => {
            setEntries((l) => l.map((x) => (x.id === e.id ? e : x)));
            setEditing(null);
          }}
          onDeleted={(id) => {
            setEntries((l) => l.filter((x) => x.id !== id));
            setEditing(null);
          }}
        />
      )}
      {waterSheet && <WaterSheet onClose={() => setWaterSheet(false)} onChange={(d) => { void addWater(d); setWaterSheet(false); }} />}
    </div>
  );
}

function EditEntry({ entry, onClose, onSaved, onDeleted }: { entry: EntryView; onClose: () => void; onSaved: (e: EntryView) => void; onDeleted: (id: string) => void }) {
  const [value, setValue] = useState(String(entry.quantity).replace(".", ","));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qty = num(value);
  const n = rescale(entry, qty);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      onSaved(await call<EntryView>("PUT", `/api/diet/entries/${entry.id}`, { quantity: qty }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Errore");
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await call("DELETE", `/api/diet/entries/${entry.id}`);
      onDeleted(entry.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Errore");
      setBusy(false);
    }
  }

  return (
    <Sheet
      title={entry.name}
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <Button variant="danger" icon="trash" onClick={remove} disabled={busy} aria-label="Elimina">
            Elimina
          </Button>
          <Button className="flex-1" onClick={save} disabled={busy || qty <= 0 || qty === entry.quantity}>
            Salva
          </Button>
        </div>
      }
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">{entry.unit === "porzione" ? "Porzioni" : `Quantità (${entry.unit})`}</span>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => /^\d{0,5}([.,]\d{0,2})?$/.test(e.target.value) && setValue(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          className="num h-14 w-full rounded-xl bg-surface2 text-center text-[32px] font-semibold outline-none ring-1 ring-transparent focus:ring-fg"
        />
      </label>
      <div className="mt-5 rounded-2xl bg-surface2 p-4">
        <div className="flex items-baseline justify-between">
          <span className="num text-4xl font-semibold">{fmtNum(n.kcal, 0)}</span>
          <span className="text-muted">kcal</span>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {([["Proteine", n.protein], ["Carboidrati", n.carbs], ["Grassi", n.fat]] as const).map(([k, v]) => (
            <div key={k}>
              <dd className="num text-2xl font-semibold leading-none">{fmtNum(v)} g</dd>
              <dt className="mt-0.5 text-xs text-muted">{k}</dt>
            </div>
          ))}
        </dl>
      </div>
      <div className="mt-3"><FormError message={error} /></div>
    </Sheet>
  );
}

function WaterSheet({ onClose, onChange }: { onClose: () => void; onChange: (delta: number) => void }) {
  const [v, setV] = useState("");
  const ml = Math.round(num(v));
  return (
    <Sheet
      title="Acqua"
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" disabled={ml <= 0} onClick={() => onChange(-ml)}>
            Togli
          </Button>
          <Button className="flex-1" disabled={ml <= 0} onClick={() => onChange(ml)}>
            Aggiungi
          </Button>
        </div>
      }
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">Quantità (ml)</span>
        <input
          inputMode="numeric"
          value={v}
          onChange={(e) => /^\d{0,4}$/.test(e.target.value) && setV(e.target.value)}
          placeholder="330"
          autoFocus
          className="num h-14 w-full rounded-xl bg-surface2 text-center text-[32px] font-semibold outline-none ring-1 ring-transparent placeholder:text-muted/40 focus:ring-fg"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {[200, 330, 750, 1000].map((x) => (
          <button key={x} type="button" onClick={() => setV(String(x))} className="h-10 rounded-full bg-surface2 px-4 text-sm font-semibold">
            {x} ml
          </button>
        ))}
      </div>
    </Sheet>
  );
}

