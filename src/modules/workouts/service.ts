import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { posts, workoutExercises, workouts } from "@/db/schema";
import { getStorage } from "@/modules/social/storage";
import { assertExercisesAccessible } from "@/modules/exercises/repository";
import { prefillSets } from "./domain/prefill";
import * as repo from "./repository";
import { finishWorkoutSchema, planSchema, startWorkoutSchema, workoutStateSchema } from "./schemas";

// ───────── Schede ─────────

async function validatePlan(userId: string, input: unknown) {
  const data = planSchema.parse(input);
  if (!(await assertExercisesAccessible(userId, data.exercises.map((e) => e.exerciseId)))) {
    throw badRequest("Esercizio non valido");
  }
  return data;
}

export async function createPlan(userId: string, input: unknown) {
  const data = await validatePlan(userId, input);
  return { id: await repo.createPlan(userId, data) };
}

export async function updatePlan(userId: string, id: string, input: unknown) {
  const data = await validatePlan(userId, input);
  if (!(await repo.updatePlan(userId, id, data))) throw notFound("Scheda non trovata");
}

export async function deletePlan(userId: string, id: string) {
  if (!(await repo.deletePlan(userId, id))) throw notFound("Scheda non trovata");
}

export async function duplicatePlan(userId: string, id: string) {
  const plan = await repo.getPlan(userId, id);
  if (!plan) throw notFound("Scheda non trovata");
  const newId = await repo.createPlan(userId, {
    name: `${plan.name} (copia)`.slice(0, 60),
    notes: plan.notes,
    exercises: plan.exercises.map(({ exerciseId, targetSets, targetReps }) => ({ exerciseId, targetSets, targetReps })),
  });
  return { id: newId };
}

// ───────── Workout ─────────

/** Avvia un workout (da scheda o vuoto). Se ce n'è già uno in corso, restituisce quello. */
export async function startWorkout(userId: string, input: unknown) {
  const data = startWorkoutSchema.parse(input ?? {});
  const active = await repo.getActiveWorkoutId(userId);
  if (active) return { id: active.id, resumed: true };

  let name = data.name || "Allenamento libero";
  let exercisesInit: { exerciseId: string; sets: { weightKg: number; reps: number }[] }[] = [];

  if (data.planId) {
    const plan = await repo.getPlan(userId, data.planId);
    if (!plan) throw notFound("Scheda non trovata");
    name = plan.name;
    const last = await repo.lastCompletedSetsFor(userId, plan.exercises.map((e) => e.exerciseId));
    exercisesInit = plan.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      sets: prefillSets(last.get(e.exerciseId) ?? null, { sets: e.targetSets, reps: e.targetReps }),
    }));
  }

  const id = await repo.insertWorkout(userId, { name, planId: data.planId ?? null, exercises: exercisesInit });
  return { id, resumed: false };
}

async function ensureInProgress(userId: string, id: string) {
  const [w] = await db()
    .select({ status: workouts.status })
    .from(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, userId)))
    .limit(1);
  if (!w) throw notFound("Allenamento non trovato");
  if (w.status !== "in_progress") throw conflict("Allenamento già concluso");
}

/** Autosave: sostituisce lo stato del workout in corso. */
export async function saveWorkoutState(userId: string, id: string, input: unknown) {
  const state = workoutStateSchema.parse(input);
  await validateState(userId, id, state);
  await db().transaction(async (tx) => {
    await repo.writeWorkoutState(tx, id, state);
    await repo.setWorkoutMeta(tx, userId, id, { name: state.name, notes: state.notes });
  });
}

/** Controlli prima di scrivere, eseguiti insieme: stato del workout, esercizi accessibili, id non altrui. */
async function validateState(userId: string, workoutId: string, state: { exercises: { id: string; exerciseId: string }[] }) {
  const ids = state.exercises.map((e) => e.id);
  const [, accessible, foreign] = await Promise.all([
    ensureInProgress(userId, workoutId),
    assertExercisesAccessible(userId, state.exercises.map((e) => e.exerciseId)),
    ids.length
      ? db().select({ id: workoutExercises.id }).from(workoutExercises).where(and(inArray(workoutExercises.id, ids), ne(workoutExercises.workoutId, workoutId)))
      : Promise.resolve([]),
  ]);
  if (!accessible) throw badRequest("Esercizio non valido");
  if (foreign.length) throw badRequest("Dati non validi");
}

export async function finishWorkout(userId: string, id: string, input: unknown) {
  const state = finishWorkoutSchema.parse(input);
  await validateState(userId, id, state);
  const completedCount = state.exercises.reduce((n, e) => n + e.sets.filter((x) => x.completed).length, 0);
  if (completedCount === 0) throw badRequest("Completa almeno una serie, oppure scarta l'allenamento");
  await db().transaction(async (tx) => {
    await repo.writeWorkoutState(tx, id, state);
    if (state.discardIncomplete) await repo.deleteIncompleteSets(tx, id);
    await repo.setWorkoutMeta(tx, userId, id, { name: state.name, notes: state.notes, finish: true });
  });
  return { id };
}

export async function discardWorkout(userId: string, id: string) {
  // l'eventuale post collegato sparisce con l'allenamento: va tolta anche la sua foto dallo storage
  const [post] = await db().select({ photoPath: posts.photoPath }).from(posts).where(and(eq(posts.workoutId, id), eq(posts.userId, userId))).limit(1);
  if (!(await repo.deleteWorkout(userId, id))) throw notFound("Allenamento non trovato");
  if (post?.photoPath) await getStorage()?.remove([post.photoPath]);
}

export const getPlans = repo.listPlans;
export const getPlan = repo.getPlan;
export const getWorkout = repo.getWorkout;
export const getActiveWorkout = repo.getActiveWorkoutId;
export const lastSetsFor = repo.lastCompletedSetsFor;
