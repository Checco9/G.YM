"use client";

import Link from "next/link";
import { useState } from "react";
import { LEVEL_LABEL, LEVELS, type Level } from "@/modules/strength/domain/levels";
import type { MuscleStrength } from "@/modules/strength/service";
import { fmtSet, fmtSigned } from "@/lib/format";
import { BodyMap } from "./body-map/body-map";
import { BACK, FRONT } from "./body-map/regions";
import { Card } from "./ui/card";
import { LevelBadge } from "./ui/level-badge";

const frontIds = new Set(FRONT.map((r) => r.muscleId));
const backIds = new Set(BACK.map((r) => r.muscleId));

export function BodyExplorer({
  muscles,
  needs,
}: {
  muscles: MuscleStrength[];
  needs: { bodyWeight: boolean; sex: boolean };
}) {
  const [view, setView] = useState<"front" | "back">("front");
  const [selected, setSelected] = useState<string | null>(null);
  const levels = Object.fromEntries(muscles.map((m) => [m.muscleId, m.level])) as Record<string, Level>;
  const current = muscles.find((m) => m.muscleId === selected) ?? null;

  function switchView(v: "front" | "back") {
    setView(v);
    if (selected && !(v === "front" ? frontIds : backIds).has(selected)) setSelected(null);
  }

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
      <div>
        <div role="tablist" aria-label="Vista" className="mx-auto mb-4 grid w-full max-w-[340px] grid-cols-2 rounded-full bg-surface p-1">
          {(["front", "back"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => switchView(v)}
              className={`h-10 rounded-full text-[15px] font-semibold ${view === v ? "bg-fg text-onfg" : "text-muted"}`}
            >
              {v === "front" ? "Fronte" : "Retro"}
            </button>
          ))}
        </div>
        <BodyMap view={view} levels={levels} selected={selected} onSelect={(id) => setSelected(id === selected ? null : id)} />
        <Legend />
      </div>

      <div className="space-y-4">
        {(needs.sex || needs.bodyWeight) && (
          <Card className="border border-line text-[15px]">
            <p className="font-semibold">Per vedere i livelli servono due dati</p>
            <p className="mt-1 text-muted">
              {needs.sex && "Indica il sesso nel profilo. "}
              {needs.bodyWeight && "Registra il tuo peso corporeo. "}
              Il livello dipende dal carico rispetto al tuo peso.
            </p>
            <div className="mt-3 flex gap-4 text-sm font-semibold">
              {needs.sex && <Link href="/profile" className="underline underline-offset-4">Vai al profilo</Link>}
              {needs.bodyWeight && <Link href="/progress/weight" className="underline underline-offset-4">Registra il peso</Link>}
            </div>
          </Card>
        )}

        {current ? (
          <MuscleDetail m={current} />
        ) : (
          <Card>
            <h2 className="num text-3xl font-semibold">Tocca un muscolo</h2>
            <p className="mt-1 text-muted">Vedi livello, esercizi principali, miglior risultato e progressione.</p>
          </Card>
        )}

        <ul className="grid grid-cols-2 gap-2">
          {muscles.map((m) => (
            <li key={m.muscleId}>
              <button
                onClick={() => {
                  const inFront = frontIds.has(m.muscleId);
                  const inBack = backIds.has(m.muscleId);
                  if (view === "front" && !inFront && inBack) setView("back");
                  if (view === "back" && !inBack && inFront) setView("front");
                  setSelected(m.muscleId);
                }}
                className={`lv-${m.level} flex min-h-12 w-full items-center gap-2.5 rounded-2xl px-3 text-left ${selected === m.muscleId ? "bg-surface2" : "bg-surface"}`}
              >
                <span className="size-3 shrink-0 rounded-full" style={{ background: "var(--lv)" }} />
                <span className="text-[15px] font-medium leading-tight">{m.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <ul className="mx-auto mt-4 flex max-w-[340px] flex-wrap justify-center gap-x-4 gap-y-1.5 text-sm text-muted">
      {LEVELS.map((l) => (
        <li key={l} className={`lv-${l} flex items-center gap-1.5`}>
          <span className="size-3 rounded-full" style={{ background: "var(--lv)" }} />
          {LEVEL_LABEL[l]}
        </li>
      ))}
    </ul>
  );
}

function MuscleDetail({ m }: { m: MuscleStrength }) {
  const main = m.exercises.filter((e) => e.role === "primary").slice(0, 4);
  return (
    <Card className={`lv-${m.level}`} aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <h2 className="num text-4xl font-semibold leading-none">{m.name}</h2>
      </div>
      <div className="mt-3"><LevelBadge level={m.level} /></div>

      <dl className="mt-5 space-y-4">
        <div>
          <dt className="text-sm text-muted">Esercizi principali</dt>
          <dd className="mt-1.5 space-y-1">
            {main.map((e) => (
              <div key={e.exerciseId} className="flex items-center justify-between gap-3">
                <Link href={e.trained ? `/progress/exercises/${e.exerciseId}` : "#"} className={`text-[17px] ${e.trained ? "underline decoration-line underline-offset-4" : "text-muted"}`}>
                  {e.name}
                </Link>
                <LevelBadge level={e.level} compact />
              </div>
            ))}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Miglior risultato</dt>
          <dd className="num mt-0.5 text-3xl font-semibold">
            {m.best ? (
              <>
                {fmtSet(m.best.weightKg, m.best.reps)}
                <span className="ml-2 font-sans text-base font-normal text-muted">{m.best.exerciseName}</span>
              </>
            ) : (
              <span className="text-muted">Nessun dato</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Progressione negli ultimi 30 giorni</dt>
          <dd className="num mt-0.5 text-3xl font-semibold">
            {m.progression30d === null ? <span className="text-muted">Non ancora calcolabile</span> : `${fmtSigned(m.progression30d, 0)}%`}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
