import { estimateOneRepMax } from "@/modules/stats/domain/one-rep-max";
import type { HistoricalWorkout } from "@/modules/stats/domain/types";

export const LEVELS = ["unranked", "beginner", "intermediate", "advanced", "elite"] as const;
export type Level = (typeof LEVELS)[number];
export type RankedLevel = Exclude<Level, "unranked">;
export type Sex = "male" | "female";

export const LEVEL_LABEL: Record<Level, string> = {
  unranked: "Non classificato",
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzato",
  elite: "Elite",
};

export const levelIndex = (l: Level) => LEVELS.indexOf(l);

/** Soglie minime del rapporto 1RM / peso corporeo, una per livello. */
export type Thresholds = Record<RankedLevel, number>;

/** Dati per classificare. In futuro si possono aggiungere altri input (età, tipo di attrezzo...). */
export type ClassifyInput = {
  estimatedOneRepMax: number | null;
  bodyWeightKg: number | null;
  thresholds: Thresholds | null;
};

export function classify({ estimatedOneRepMax, bodyWeightKg, thresholds }: ClassifyInput): Level {
  if (!thresholds || !estimatedOneRepMax || !bodyWeightKg || bodyWeightKg <= 0) return "unranked";
  const ratio = estimatedOneRepMax / bodyWeightKg;
  let level: Level = "beginner";
  for (const l of ["intermediate", "advanced", "elite"] as const) {
    if (ratio >= thresholds[l]) level = l;
  }
  return level;
}

/** Il miglior 1RM stimato su un insieme di workout (opzionalmente solo prima di una data). */
export function bestEstimatedOneRepMax(
  workouts: HistoricalWorkout[],
  exerciseId: string,
  before?: Date,
): number | null {
  let best: number | null = null;
  for (const w of workouts) {
    if (before && w.startedAt >= before) continue;
    for (const ex of w.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const s of ex.sets) {
        const e = estimateOneRepMax(s.weightKg, s.reps);
        if (e !== null && (best === null || e > best)) best = e;
      }
    }
  }
  return best;
}

export type MuscleExerciseEntry = { exerciseId: string; role: "primary" | "secondary"; level: Level };

/**
 * Regola per il livello di un muscolo: il più alto tra gli esercizi PRIMARI classificati.
 * Se in futuro vorrai che anche i secondari contribuiscano, cambia solo questa funzione.
 */
export function muscleLevel(entries: MuscleExerciseEntry[]): Level {
  let best: Level = "unranked";
  for (const e of entries) {
    if (e.role !== "primary") continue;
    if (levelIndex(e.level) > levelIndex(best)) best = e.level;
  }
  return best;
}
