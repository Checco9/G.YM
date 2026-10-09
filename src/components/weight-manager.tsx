"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { fmtDate, fmtNum, fmtSigned } from "@/lib/format";
import { Button, IconButton } from "./ui/button";
import { Card, EmptyState, SectionTitle, Stat } from "./ui/card";
import { LineChart } from "./ui/charts";
import { Field, FormError, TextInput } from "./ui/field";
import { Sheet } from "./ui/sheet";

type Entry = { id: string; measuredOn: string; weightKg: number };
const RANGES = [
  { label: "30 giorni", days: 30 },
  { label: "90 giorni", days: 90 },
  { label: "Tutto", days: 0 },
] as const;

const parseKg = (s: string) => parseFloat(s.replace(",", "."));

export function WeightManager({ entries, today, tz }: { entries: Entry[]; today: string; tz: string }) {
  const router = useRouter();
  const [range, setRange] = useState<number>(90);
  const [date, setDate] = useState(today);
  const [kg, setKg] = useState(entries.length ? String(entries[entries.length - 1].weightKg).replace(".", ",") : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);

  const first = entries[0];
  const last = entries[entries.length - 1];

  const points = useMemo(() => {
    const cutoff = range ? Date.now() - range * 86400000 : 0;
    return entries
      .filter((e) => new Date(e.measuredOn + "T12:00:00Z").getTime() >= cutoff)
      .map((e) => ({ t: new Date(e.measuredOn + "T12:00:00Z").getTime(), y: e.weightKg }));
  }, [entries, range]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const w = parseKg(kg);
    if (!Number.isFinite(w)) return setError("Inserisci un peso valido");
    setBusy(true);
    setError(null);
    try {
      await call("POST", "/api/weights", { measuredOn: date, weightKg: w });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Errore");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
        <Card>
          {entries.length === 0 ? (
            <EmptyState title="Nessuna misurazione" text="Inserisci il tuo peso di oggi per iniziare a vedere l'andamento." />
          ) : (
            <>
              <div className="mb-3 flex gap-2">
                {RANGES.map((r) => (
                  <button
                    key={r.label}
                    onClick={() => setRange(r.days)}
                    aria-pressed={range === r.days}
                    className={`h-9 rounded-full px-3.5 text-sm font-semibold ${range === r.days ? "bg-fg text-onfg" : "bg-surface2 text-muted"}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {points.length ? (
                <LineChart points={points} unit="kg" tz={tz} />
              ) : (
                <p className="py-10 text-center text-muted">Nessuna misurazione in questo periodo.</p>
              )}
            </>
          )}
        </Card>

        <div className="space-y-4">
          {first && last && (
            <Card className="grid grid-cols-3 gap-2 p-4 md:grid-cols-1 md:gap-5 md:p-5">
              <Stat label="Iniziale" value={fmtNum(first.weightKg)} unit="kg" />
              <Stat label="Attuale" value={fmtNum(last.weightKg)} unit="kg" />
              <Stat label="Differenza" value={fmtSigned(Math.round((last.weightKg - first.weightKg) * 100) / 100)} unit="kg" />
            </Card>
          )}
          <Card>
            <form onSubmit={add} className="space-y-3">
              <h2 className="num text-2xl font-semibold">Nuova misurazione</h2>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Peso (kg)">
                  <TextInput inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="82,4" required />
                </Field>
                <Field label="Data">
                  <TextInput type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
                </Field>
              </div>
              <FormError message={error} />
              <Button type="submit" className="w-full" disabled={busy}>
                Salva peso
              </Button>
            </form>
          </Card>
        </div>
      </div>

      {entries.length > 0 && (
        <>
          <SectionTitle>Storico</SectionTitle>
          <Card className="divide-y divide-line p-0">
            {[...entries].reverse().map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <span className="text-muted">{fmtDate(e.measuredOn + "T12:00:00Z", "UTC", { day: "numeric", month: "long", year: "numeric" })}</span>
                <div className="flex items-center">
                  <span className="num text-2xl font-semibold">{fmtNum(e.weightKg, 2)} kg</span>
                  <IconButton icon="edit" label="Modifica" onClick={() => setEditing(e)} className="ml-1" />
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      {editing && <EditEntry entry={editing} today={today} onClose={() => setEditing(null)} onDone={() => { setEditing(null); router.refresh(); }} />}
    </div>
  );
}

function EditEntry({ entry, today, onClose, onDone }: { entry: Entry; today: string; onClose: () => void; onDone: () => void }) {
  const [kg, setKg] = useState(String(entry.weightKg).replace(".", ","));
  const [date, setDate] = useState(entry.measuredOn);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const w = parseKg(kg);
    if (!Number.isFinite(w)) return setError("Inserisci un peso valido");
    setBusy(true);
    try {
      await call("PUT", `/api/weights/${entry.id}`, { measuredOn: date, weightKg: w });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Errore");
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await call("DELETE", `/api/weights/${entry.id}`);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Errore");
      setBusy(false);
    }
  }

  return (
    <Sheet
      title="Modifica misurazione"
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <Button variant="danger" icon="trash" onClick={remove} disabled={busy}>
            Elimina
          </Button>
          <Button className="flex-1" onClick={save} disabled={busy}>
            Salva
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Peso (kg)">
          <TextInput inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} />
        </Field>
        <Field label="Data">
          <TextInput type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <div className="mt-3"><FormError message={error} /></div>
    </Sheet>
  );
}
