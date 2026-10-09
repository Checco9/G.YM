import { and, asc, desc, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import {
  exercises,
  sets,
  workoutExercises,
  workoutPlanExercises,
  workoutPlans,
  workouts,
} from "@/db/schema";

// ───────── Schede ─────────

export async function listPlans(userId: string) {
  const plans = await db().select().from(workoutPlans).where(eq(workoutPlans.userId, userId)).orderBy(desc(workoutPlans.updatedAt));
  if (!plans.length) return [];
  const items = await db()
    .select({
      planId: workoutPlanExercises.planId,
      position: workoutPlanExercises.position,
      name: exercises.name,
    })
    .from(workoutPlanExercises)
    .innerJoin(exercises, eq(exercises.id, workoutPlanExercises.exerciseId))
    .where(inArray(workoutPlanExercises.planId, plans.map((p) => p.id)))
    .orderBy(asc(workoutPlanExercises.position));
  return plans.map((p) => ({ ...p, exerciseNames: items.filter((i) => i.planId === p.id).map((i) => i.name) }));
}

export async function getPlan(userId: string, planId: string) {
  const [plan] = await db()
    .select()
    .from(workoutPlans)
    .where(and(eq(workoutPlans.id, planId), eq(workoutPlans.userId, userId)))
    .limit(1);
  if (!plan) return null;
  const items = await db()
    .select({
      id: workoutPlanExercises.id,
      exerciseId: workoutPlanExercises.exerciseId,
      name: exercises.name,
      targetSets: workoutPlanExercises.targetSets,
      targetReps: workoutPlanExercises.targetReps,
    })
    .from(workoutPlanExercises)
    .innerJoin(exercises, eq(exercises.id, workoutPlanExercises.exerciseId))
    .where(eq(workoutPlanExercises.planId, planId))
    .orderBy(asc(workoutPlanExercises.position));
  return { ...plan, exercises: items };
}

type PlanInput = {
  name: string;
  notes?: string | null;
  exercises: { exerciseId: string; targetSets: number; targetReps: number }[];
};

async function writePlanExercises(tx: DbOrTx, planId: string, items: PlanInput["exercises"]) {
  await tx.delete(workoutPlanExercises).where(eq(workoutPlanExercises.planId, planId));
  if (items.length) {
    await tx.insert(workoutPlanExercises).values(items.map((e, i) => ({ planId, position: i, ...e })));
  }
}

export async function createPlan(userId: string, input: PlanInput) {
  return db().transaction(async (tx) => {
    const [p] = await tx
      .insert(workoutPlans)
      .values({ userId, name: input.name, notes: input.notes ?? null })
      .returning({ id: workoutPlans.id });
    await writePlanExercises(tx, p.id, input.exercises);
    return p.id;
  });
}

export async function updatePlan(userId: string, planId: string, input: PlanInput) {
  return db().transaction(async (tx) => {
    const res = await tx
      .update(workoutPlans)
      .set({ name: input.name, notes: input.notes ?? null, updatedAt: new Date() })
      .where(and(eq(workoutPlans.id, planId), eq(workoutPlans.userId, userId)))
      .returning({ id: workoutPlans.id });
    if (!res.length) return false;
    await writePlanExercises(tx, planId, input.exercises);
    return true;
  });
}

export async function deletePlan(userId: string, planId: string) {
  const res = await db()
    .delete(workoutPlans)
    .where(and(eq(workoutPlans.id, planId), eq(workoutPlans.userId, userId)))
    .returning({ id: workoutPlans.id });
  return res.length > 0;
}

// ───────── Workout ─────────

export async function getActiveWorkoutId(userId: string) {
  const [w] = await db()
    .select({ id: workouts.id, name: workouts.name, startedAt: workouts.startedAt })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.status, "in_progress")))
    .orderBy(desc(workouts.startedAt))
    .limit(1);
  return w ?? null;
}

export async function getWorkout(userId: string, workoutId: string) {
  const [w] = await db()
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .limit(1);
  if (!w) return null;
  const wes = await db()
    .select({
      id: workoutExercises.id,
      exerciseId: workoutExercises.exerciseId,
      name: exercises.name,
      position: workoutExercises.position,
    })
    .from(workoutExercises)
    .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .where(eq(workoutExercises.workoutId, workoutId))
    .orderBy(asc(workoutExercises.position));
  const allSets = wes.length
    ? await db()
        .select()
        .from(sets)
        .where(inArray(sets.workoutExerciseId, wes.map((e) => e.id)))
        .orderBy(asc(sets.position))
    : [];
  return {
    ...w,
    exercises: wes.map((e) => ({
      ...e,
      sets: allSets
        .filter((s) => s.workoutExerciseId === e.id)
        .map((s) => ({ id: s.id, weightKg: s.weightKg, reps: s.reps, completed: s.completed })),
    })),
  };
}

export async function insertWorkout(
  userId: string,
  data: {
    name: string;
    planId: string | null;
    exercises: { exerciseId: string; sets: { weightKg: number; reps: number }[] }[];
  },
) {
  return db().transaction(async (tx) => {
    const [w] = await tx
      .insert(workouts)
      .values({ userId, name: data.name, planId: data.planId })
      .returning({ id: workouts.id });
    for (const [i, ex] of data.exercises.entries()) {
      const [we] = await tx
        .insert(workoutExercises)
        .values({ workoutId: w.id, exerciseId: ex.exerciseId, position: i })
        .returning({ id: workoutExercises.id });
      if (ex.sets.length) {
        await tx.insert(sets).values(ex.sets.map((s, j) => ({ workoutExerciseId: we.id, position: j, ...s })));
      }
    }
    return w.id;
  });
}

type State = {
  name: string;
  notes?: string | null;
  exercises: {
    id: string;
    exerciseId: string;
    sets: { id: string; weightKg: number; reps: number; completed: boolean }[];
  }[];
};

/**
 * Sostituisce lo stato di un workout (esercizi e serie) con poche query, indipendentemente
 * da quanti esercizi o serie ci sono: con un database remoto ogni viaggio di rete costa.
 * Le scritture sono upsert sugli id generati dal client, quindi ripeterle è sicuro;
 * le clausole `setWhere` impediscono di "rubare" righe che appartengono ad altri workout.
 */
export async function writeWorkoutState(tx: DbOrTx, workoutId: string, state: State) {
  const existing = await tx.select({ id: workoutExercises.id }).from(workoutExercises).where(eq(workoutExercises.workoutId, workoutId));
  const keep = new Set(state.exercises.map((e) => e.id));
  const toDelete = existing.map((e) => e.id).filter((id) => !keep.has(id));
  if (toDelete.length) await tx.delete(workoutExercises).where(inArray(workoutExercises.id, toDelete));
  if (!state.exercises.length) return;

  await tx
    .insert(workoutExercises)
    .values(state.exercises.map((e, i) => ({ id: e.id, workoutId, exerciseId: e.exerciseId, position: i })))
    .onConflictDoUpdate({
      target: workoutExercises.id,
      set: { position: sql`excluded.position`, exerciseId: sql`excluded.exercise_id` },
      setWhere: eq(workoutExercises.workoutId, workoutId),
    });

  const weIds = state.exercises.map((e) => e.id);
  const rows = state.exercises.flatMap((e) =>
    e.sets.map((s, j) => ({ id: s.id, workoutExerciseId: e.id, position: j, weightKg: s.weightKg, reps: s.reps, completed: s.completed })),
  );
  // serie rimosse dall'utente
  await tx
    .delete(sets)
    .where(and(inArray(sets.workoutExerciseId, weIds), rows.length ? notInArray(sets.id, rows.map((r) => r.id)) : undefined));
  if (rows.length) {
    await tx
      .insert(sets)
      .values(rows)
      .onConflictDoUpdate({
        target: sets.id,
        set: {
          workoutExerciseId: sql`excluded.workout_exercise_id`,
          position: sql`excluded.position`,
          weightKg: sql`excluded.weight_kg`,
          reps: sql`excluded.reps`,
          completed: sql`excluded.completed`,
        },
        setWhere: inArray(sets.workoutExerciseId, weIds),
      });
  }
}

export async function setWorkoutMeta(
  tx: DbOrTx,
  userId: string,
  workoutId: string,
  data: { name: string; notes?: string | null; finish?: boolean },
) {
  const res = await tx
    .update(workouts)
    .set({
      name: data.name,
      notes: data.notes ?? null,
      updatedAt: new Date(),
      ...(data.finish ? { status: "completed" as const, endedAt: new Date() } : {}),
    })
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId), eq(workouts.status, "in_progress")))
    .returning({ id: workouts.id });
  return res.length > 0;
}

export async function deleteWorkout(userId: string, workoutId: string) {
  const res = await db()
    .delete(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .returning({ id: workouts.id });
  return res.length > 0;
}

export async function deleteIncompleteSets(tx: DbOrTx, workoutId: string) {
  await tx.execute(sql`
    delete from sets where completed = false
      and workout_exercise_id in (select id from workout_exercises where workout_id = ${workoutId})`);
  // esercizi rimasti senza serie
  await tx.execute(sql`
    delete from workout_exercises we where we.workout_id = ${workoutId}
      and not exists (select 1 from sets s where s.workout_exercise_id = we.id)`);
}

/** Ultime serie completate di un esercizio, dall'allenamento concluso più recente che lo contiene. */
export async function lastCompletedSetsFor(userId: string, exerciseIds: string[], excludeWorkoutId?: string) {
  const result = new Map<string, { weightKg: number; reps: number }[]>();
  if (!exerciseIds.length) return result;
  const rows = await db()
    .select({
      exerciseId: workoutExercises.exerciseId,
      workoutId: workouts.id,
      startedAt: workouts.startedAt,
      position: sets.position,
      weightKg: sets.weightKg,
      reps: sets.reps,
    })
    .from(sets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, sets.workoutExerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(
      and(
        eq(workouts.userId, userId),
        eq(workouts.status, "completed"),
        eq(sets.completed, true),
        inArray(workoutExercises.exerciseId, exerciseIds),
        excludeWorkoutId ? ne(workouts.id, excludeWorkoutId) : undefined,
      ),
    )
    .orderBy(desc(workouts.startedAt), asc(sets.position));
  const latestWorkout = new Map<string, string>();
  for (const r of rows) {
    if (!latestWorkout.has(r.exerciseId)) latestWorkout.set(r.exerciseId, r.workoutId);
    if (latestWorkout.get(r.exerciseId) !== r.workoutId) continue;
    const arr = result.get(r.exerciseId) ?? [];
    arr.push({ weightKg: r.weightKg, reps: r.reps });
    result.set(r.exerciseId, arr);
  }
  return result;
}
