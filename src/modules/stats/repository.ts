import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/lib/db";
import { exercises, sets, workoutExercises, workouts } from "@/db/schema";
import type { HistoricalWorkout } from "./domain/types";

export type History = {
  workouts: HistoricalWorkout[];
  exerciseNames: Map<string, string>;
};

/**
 * Carica lo storico concluso di uno o più utenti: solo serie completate, sempre in 2 query
 * (parallele) qualunque sia il numero di utenti. Per pochi utenti e qualche migliaio di serie è più
 * semplice e affidabile che mantenere tabelle di aggregati; se un giorno servisse, qui si mette una cache.
 */
export async function loadHistories(userIds: string[]): Promise<Map<string, History>> {
  const result = new Map<string, History>(userIds.map((id) => [id, { workouts: [], exerciseNames: new Map() }]));
  if (!userIds.length) return result;

  const [ws, rows] = await Promise.all([
    db()
      .select()
      .from(workouts)
      .where(and(inArray(workouts.userId, userIds), eq(workouts.status, "completed")))
      .orderBy(asc(workouts.startedAt)),
    // Le serie di ogni esercizio arrivano già raggruppate in due array: ~4 volte meno righe da trasferire
    // e da interpretare, e i pesi sono convertiti in numeri dal database.
    db()
      .select({
        workoutId: workoutExercises.workoutId,
        weId: workoutExercises.id,
        exerciseId: workoutExercises.exerciseId,
        exerciseName: exercises.name,
        weights: sql<number[]>`array_agg(${sets.weightKg}::float8 order by ${sets.position})`,
        reps: sql<number[]>`array_agg(${sets.reps} order by ${sets.position})`,
      })
      .from(sets)
      .innerJoin(workoutExercises, eq(workoutExercises.id, sets.workoutExerciseId))
      .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
      .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
      .where(and(inArray(workouts.userId, userIds), eq(workouts.status, "completed"), eq(sets.completed, true)))
      .groupBy(workoutExercises.id, workoutExercises.workoutId, workoutExercises.exerciseId, workoutExercises.position, exercises.name)
      .orderBy(asc(workoutExercises.position)),
  ]);

  const byWorkout = new Map<string, Map<string, { exerciseId: string; sets: { weightKg: number; reps: number }[] }>>();
  const nameOf = new Map<string, string>();
  for (const r of rows) {
    nameOf.set(r.exerciseId, r.exerciseName);
    const m = byWorkout.get(r.workoutId) ?? new Map();
    m.set(r.weId, { exerciseId: r.exerciseId, sets: r.weights.map((weightKg, i) => ({ weightKg: Number(weightKg), reps: Number(r.reps[i]) })) });
    byWorkout.set(r.workoutId, m);
  }

  for (const w of ws) {
    const h = result.get(w.userId)!;
    h.workouts.push({
      id: w.id,
      name: w.name,
      startedAt: w.startedAt,
      endedAt: w.endedAt,
      exercises: [...(byWorkout.get(w.id)?.values() ?? [])],
    });
    for (const e of h.workouts[h.workouts.length - 1].exercises) h.exerciseNames.set(e.exerciseId, nameOf.get(e.exerciseId) ?? "Esercizio");
  }
  return result;
}

/**
 * Storico dell'utente, memoizzato per richiesta: layout, pagina e componenti che lo chiedono
 * più volte nella stessa richiesta fanno una sola lettura dal database.
 */
export const loadHistory = cache(async (userId: string): Promise<History> => (await loadHistories([userId])).get(userId)!);
