import type { PREvent } from "@/modules/stats/domain/records";
import type { HistoricalWorkout } from "@/modules/stats/domain/types";
import { workoutDurationMin, workoutSetCount, workoutVolume } from "@/modules/stats/domain/volume";

export type Period = "week" | "month" | "all";
export const PERIOD_DAYS: Record<Period, number | null> = { week: 7, month: 30, all: null };
export const PERIOD_LABEL: Record<Period, string> = { week: "7 giorni", month: "30 giorni", all: "Sempre" };

export type PeriodMetrics = {
  workouts: number;
  volume: number;
  minutes: number;
  sets: number;
  records: number;
  /** esercizi diversi allenati nel periodo */
  variety: number;
};

/** Metriche di un utente in una finestra temporale (`since` null = da sempre). Pura e testata. */
export function periodMetrics(workouts: HistoricalWorkout[], prs: PREvent[], since: Date | null): PeriodMetrics {
  const inWindow = (d: Date) => !since || d >= since;
  const ws = workouts.filter((w) => inWindow(w.startedAt));
  const exercises = new Set<string>();
  let volume = 0;
  let minutes = 0;
  let sets = 0;
  for (const w of ws) {
    volume += workoutVolume(w);
    minutes += workoutDurationMin(w) ?? 0;
    sets += workoutSetCount(w);
    for (const e of w.exercises) exercises.add(e.exerciseId);
  }
  return {
    workouts: ws.length,
    volume: Math.round(volume),
    minutes,
    sets,
    records: prs.filter((p) => inWindow(p.date)).length,
    variety: exercises.size,
  };
}

export type Category = "xp" | "workouts" | "volume" | "time" | "records" | "variety" | "streak" | "social";

/** Le categorie senza periodo (XP totale e serie in corso) ignorano il filtro. */
export const CATEGORIES: { key: Category; label: string; hint: string; periodic: boolean }[] = [
  { key: "xp", label: "XP", hint: "Livello e punti totali", periodic: false },
  { key: "workouts", label: "Allenamenti", hint: "Quanti allenamenti hai fatto", periodic: true },
  { key: "volume", label: "Volume", hint: "Chili sollevati in totale", periodic: true },
  { key: "time", label: "Tempo", hint: "Ore passate ad allenarti", periodic: true },
  { key: "records", label: "Record", hint: "Record personali battuti", periodic: true },
  { key: "variety", label: "Varietà", hint: "Esercizi diversi provati", periodic: true },
  { key: "streak", label: "Costanza", hint: "Settimane di fila con almeno un allenamento", periodic: false },
  { key: "social", label: "Più sostenuto", hint: "Reazioni e commenti ricevuti dagli altri", periodic: true },
];
