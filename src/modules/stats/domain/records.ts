import { estimateOneRepMax } from "./one-rep-max";
import type { HistoricalWorkout } from "./types";

export type PRKind = "weight" | "estimated_1rm";

export type PREvent = {
  workoutId: string;
  exerciseId: string;
  date: Date;
  weightKg: number;
  reps: number;
  estimatedOneRepMax: number;
  kinds: PRKind[];
};

/**
 * Calcola tutti i record personali scorrendo lo storico in ordine cronologico.
 *
 * Regole (V1, volutamente semplici):
 *  - la prima volta che si fa un esercizio fissa il riferimento ma NON è un PR;
 *  - per ogni esercizio in un workout conta una sola serie: la migliore per 1RM stimato;
 *  - è PR "estimated_1rm" se il 1RM stimato supera strettamente tutto ciò che c'era prima;
 *  - è PR "weight" se il carico supera strettamente il carico massimo precedente;
 *  - un workout non può battere i propri stessi record: il confronto è solo con i workout precedenti.
 */
export function computePRTimeline(workouts: HistoricalWorkout[]): PREvent[] {
  const sorted = [...workouts].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  const bestE1rm = new Map<string, number>();
  const bestWeight = new Map<string, number>();
  const events: PREvent[] = [];

  for (const w of sorted) {
    const updates: [string, number, number][] = [];

    for (const ex of w.exercises) {
      let top: { weightKg: number; reps: number; e1rm: number } | null = null;
      let heaviest = 0;
      for (const s of ex.sets) {
        if (s.weightKg > heaviest && s.reps >= 1) heaviest = s.weightKg;
        const e = estimateOneRepMax(s.weightKg, s.reps);
        if (e !== null && (!top || e > top.e1rm)) top = { weightKg: s.weightKg, reps: s.reps, e1rm: e };
      }

      const prevE = bestE1rm.get(ex.exerciseId);
      const prevW = bestWeight.get(ex.exerciseId);

      if (top && prevE !== undefined && prevW !== undefined) {
        const kinds: PRKind[] = [];
        if (top.e1rm > prevE) kinds.push("estimated_1rm");
        if (heaviest > prevW) kinds.push("weight");
        if (kinds.length) {
          let shown = top;
          if (!kinds.includes("estimated_1rm")) {
            const hs = ex.sets.filter((s) => s.weightKg === heaviest).sort((a, b) => b.reps - a.reps)[0];
            shown = { weightKg: hs.weightKg, reps: hs.reps, e1rm: estimateOneRepMax(hs.weightKg, hs.reps) ?? 0 };
          }
          events.push({
            workoutId: w.id,
            exerciseId: ex.exerciseId,
            date: w.startedAt,
            weightKg: shown.weightKg,
            reps: shown.reps,
            estimatedOneRepMax: shown.e1rm,
            kinds,
          });
        }
      }
      updates.push([ex.exerciseId, top?.e1rm ?? 0, heaviest]);
    }

    for (const [id, e, wt] of updates) {
      bestE1rm.set(id, Math.max(e, bestE1rm.get(id) ?? 0));
      bestWeight.set(id, Math.max(wt, bestWeight.get(id) ?? 0));
    }
  }
  return events;
}
