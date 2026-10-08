import { estimateOneRepMax } from "@/modules/stats/domain/one-rep-max";
import type { WorkoutDetail } from "@/modules/stats/service";
import type { PostSnapshot } from "../types";

/** Riassume un allenamento per il post: numeri principali e fino a 4 esercizi in evidenza (prima i record). */
export function buildSnapshot(d: WorkoutDetail): PostSnapshot {
  const highlights = d.exercises
    .map((e) => {
      let best = e.sets[0];
      let bestKey = -1;
      for (const s of e.sets) {
        const k = estimateOneRepMax(s.weightKg, s.reps) ?? s.weightKg / 1000;
        if (k > bestKey) {
          best = s;
          bestKey = k;
        }
      }
      return { name: e.name, weightKg: best.weightKg, reps: best.reps, pr: e.pr !== null, volume: e.volume };
    })
    .sort((a, b) => Number(b.pr) - Number(a.pr) || b.volume - a.volume)
    .slice(0, 4)
    .map(({ volume: _v, ...h }) => h);

  return {
    name: d.name,
    startedAt: d.startedAt,
    durationMin: d.durationMin,
    exerciseCount: d.exerciseCount,
    setCount: d.setCount,
    volume: d.volume,
    prCount: d.prs.length,
    highlights,
  };
}
