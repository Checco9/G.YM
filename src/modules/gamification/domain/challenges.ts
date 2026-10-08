import { daysBetweenKeys } from "@/lib/dates";
import type { PREvent } from "@/modules/stats/domain/records";
import type { HistoricalWorkout } from "@/modules/stats/domain/types";
import { workoutVolume } from "@/modules/stats/domain/volume";

export type ChallengeKind = "workouts" | "volume" | "sets" | "prs";

export const CHALLENGE_KIND_LABEL: Record<ChallengeKind, { label: string; unit: string }> = {
  workouts: { label: "Allenamenti", unit: "allenamenti" },
  volume: { label: "Volume totale", unit: "kg" },
  sets: { label: "Serie completate", unit: "serie" },
  prs: { label: "Record personali", unit: "record" },
};

export type ChallengeDef = { kind: ChallengeKind; targetValue: number; startsOn: string; endsOn: string };
export type ChallengeStatus = "active" | "completed" | "failed";

export type ChallengeProgress = { current: number; percent: number; status: ChallengeStatus; daysLeft: number };

/** I progressi si calcolano sempre dallo storico, nell'intervallo [startsOn, endsOn] (estremi inclusi). */
export function challengeProgress(
  c: ChallengeDef,
  data: { workouts: HistoricalWorkout[]; prs: PREvent[]; dayOf: (d: Date) => string },
  todayKey: string,
): ChallengeProgress {
  const inRange = (d: Date) => {
    const k = data.dayOf(d);
    return k >= c.startsOn && k <= c.endsOn;
  };
  const ws = data.workouts.filter((w) => inRange(w.startedAt));
  let current = 0;
  if (c.kind === "workouts") current = ws.length;
  if (c.kind === "volume") current = Math.round(ws.reduce((n, w) => n + workoutVolume(w), 0));
  if (c.kind === "sets") current = ws.reduce((n, w) => n + w.exercises.reduce((s, e) => s + e.sets.length, 0), 0);
  if (c.kind === "prs") current = data.prs.filter((p) => inRange(p.date)).length;

  const completed = current >= c.targetValue;
  const over = todayKey > c.endsOn;
  return {
    current,
    percent: Math.min(100, Math.round((current / c.targetValue) * 100)),
    status: completed ? "completed" : over ? "failed" : "active",
    daysLeft: Math.max(0, daysBetweenKeys(todayKey, c.endsOn)),
  };
}

export const CHALLENGE_TEMPLATES: { label: string; kind: ChallengeKind; target: number; days: number }[] = [
  { label: "Settimana perfetta: 4 allenamenti in 7 giorni", kind: "workouts", target: 4, days: 7 },
  { label: "Mese costante: 12 allenamenti in 30 giorni", kind: "workouts", target: 12, days: 30 },
  { label: "20.000 kg di volume in 14 giorni", kind: "volume", target: 20000, days: 14 },
  { label: "100 serie in 14 giorni", kind: "sets", target: 100, days: 14 },
  { label: "3 record in 30 giorni", kind: "prs", target: 3, days: 30 },
];
