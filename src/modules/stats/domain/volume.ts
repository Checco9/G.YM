import type { HistoricalWorkout, SetRecord } from "./types";

/** Volume di una serie: peso × ripetizioni. */
export function setVolume(s: SetRecord): number {
  return s.weightKg * s.reps;
}

export function setsVolume(sets: SetRecord[]): number {
  return round2(sets.reduce((sum, s) => sum + setVolume(s), 0));
}

export function workoutVolume(w: HistoricalWorkout): number {
  return round2(w.exercises.reduce((sum, e) => sum + setsVolume(e.sets), 0));
}

export function workoutSetCount(w: HistoricalWorkout): number {
  return w.exercises.reduce((n, e) => n + e.sets.length, 0);
}

export function workoutDurationMin(w: HistoricalWorkout): number | null {
  if (!w.endedAt) return null;
  return Math.max(0, Math.round((w.endedAt.getTime() - w.startedAt.getTime()) / 60000));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
