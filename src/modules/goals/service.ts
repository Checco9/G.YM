import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { badRequest, notFound } from "@/lib/errors";
import { dayKey } from "@/lib/dates";
import { goals, exercises } from "@/db/schema";
import { assertExercisesAccessible } from "@/modules/exercises/repository";
import { listWeights, type WeightEntry } from "@/modules/body/service";
import type { History } from "@/modules/stats/repository";
import { weeklyStreak } from "@/modules/stats/domain/streak";
import { setsVolume } from "@/modules/stats/domain/volume";
import { bestEstimatedOneRepMax } from "@/modules/strength/domain/levels";
import { goalProgress } from "./domain/progress";

export const GOAL_KINDS = ["exercise_weight", "exercise_1rm", "body_weight", "workout_count", "total_volume", "streak_weeks"] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];

export const goalSchema = z.object({
  kind: z.enum(GOAL_KINDS),
  exerciseId: z.string().uuid().nullish(),
  title: z.string().trim().max(80).optional(),
  targetValue: z.number().min(1).max(10_000_000),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
});

export type GoalView = {
  id: string;
  kind: GoalKind;
  title: string;
  startValue: number;
  currentValue: number;
  targetValue: number;
  percent: number;
  achieved: boolean;
  deadline: string | null;
  unit: string;
};

const UNIT: Record<GoalKind, string> = {
  exercise_weight: "kg",
  exercise_1rm: "kg",
  body_weight: "kg",
  workout_count: "allenamenti",
  total_volume: "kg",
  streak_weeks: "settimane",
};

const r1 = (n: number) => Math.round(n * 10) / 10;

function maxWeightFor(history: History, exerciseId: string, since?: Date) {
  let best = 0;
  for (const w of history.workouts) {
    if (since && w.startedAt < since) continue;
    for (const e of w.exercises) {
      if (e.exerciseId !== exerciseId) continue;
      for (const s of e.sets) if (s.reps >= 1 && s.weightKg > best) best = s.weightKg;
    }
  }
  return best;
}

/** Il valore attuale non è salvato: si ricava sempre dai dati reali. */
export async function listGoals(userId: string, history: History, tz: string, weightsIn?: WeightEntry[]): Promise<GoalView[]> {
  const [rows, weights] = await Promise.all([
    db()
      .select({ g: goals })
      .from(goals)
      .where(eq(goals.userId, userId))
      .orderBy(asc(goals.createdAt)),
    weightsIn ? Promise.resolve(weightsIn) : listWeights(userId),
  ]);
  const latestBody = weights.length ? weights[weights.length - 1].weightKg : null;
  const dayKeys = history.workouts.map((w) => dayKey(w.startedAt, tz));
  const streak = weeklyStreak(dayKeys, dayKey(new Date(), tz));

  return rows.map(({ g }) => {
    let current = g.startValue;
    switch (g.kind) {
      case "body_weight":
        current = latestBody ?? g.startValue;
        break;
      case "workout_count":
        current = history.workouts.filter((w) => w.startedAt >= g.createdAt).length;
        break;
      case "exercise_weight":
        current = Math.max(g.startValue, maxWeightFor(history, g.exerciseId!, g.createdAt));
        break;
      case "exercise_1rm":
        current = Math.max(g.startValue, r1(bestEstimatedOneRepMax(history.workouts, g.exerciseId!) ?? 0));
        break;
      case "total_volume":
        current = Math.round(
          history.workouts.filter((w) => w.startedAt >= g.createdAt).reduce((n, w) => n + w.exercises.reduce((s, e) => s + setsVolume(e.sets), 0), 0),
        );
        break;
      case "streak_weeks":
        current = streak;
        break;
    }
    const p = goalProgress(g.startValue, current, g.targetValue);
    return {
      id: g.id,
      kind: g.kind,
      title: g.title,
      startValue: g.startValue,
      currentValue: current,
      targetValue: g.targetValue,
      percent: p.percent,
      achieved: p.achieved,
      deadline: g.deadline,
      unit: UNIT[g.kind],
    };
  });
}

export async function createGoal(userId: string, input: unknown, history: History, tz: string) {
  const d = goalSchema.parse(input);
  let title = d.title?.trim() ?? "";
  let start = 0;
  let exerciseId: string | null = null;

  if (d.kind === "exercise_weight" || d.kind === "exercise_1rm") {
    if (!d.exerciseId) throw badRequest("Scegli un esercizio");
    if (!(await assertExercisesAccessible(userId, [d.exerciseId]))) throw badRequest("Esercizio non valido");
    exerciseId = d.exerciseId;
    const [ex] = await db().select({ name: exercises.name }).from(exercises).where(eq(exercises.id, d.exerciseId));
    if (d.kind === "exercise_weight") {
      start = maxWeightFor(history, d.exerciseId);
      if (!title) title = `${ex?.name ?? "Esercizio"} ${d.targetValue} kg`;
    } else {
      start = r1(bestEstimatedOneRepMax(history.workouts, d.exerciseId) ?? 0);
      if (!title) title = `${ex?.name ?? "Esercizio"}: 1RM stimato ${d.targetValue} kg`;
    }
    if (d.targetValue <= start) throw badRequest("Il target deve superare il tuo migliore attuale");
  } else if (d.kind === "body_weight") {
    const weights = await listWeights(userId);
    if (!weights.length) throw badRequest("Registra prima il tuo peso");
    start = weights[weights.length - 1].weightKg;
    if (d.targetValue === start) throw badRequest("Il target coincide con il peso attuale");
    if (!title) title = `Arrivare a ${d.targetValue} kg`;
  } else if (d.kind === "workout_count") {
    if (!title) title = `Fare ${d.targetValue} allenamenti`;
  } else if (d.kind === "total_volume") {
    if (!title) title = `Sollevare ${d.targetValue.toLocaleString("it-IT")} kg in totale`;
  } else {
    const keys = history.workouts.map((w) => dayKey(w.startedAt, tz));
    start = weeklyStreak(keys, dayKey(new Date(), tz));
    if (d.targetValue <= start) throw badRequest("Il target deve superare la tua serie attuale");
    if (!title) title = `${d.targetValue} settimane di fila`;
  }

  const [r] = await db()
    .insert(goals)
    .values({ userId, kind: d.kind, exerciseId, title, startValue: start, targetValue: d.targetValue, deadline: d.deadline ?? null })
    .returning({ id: goals.id });
  return { id: r.id };
}

export async function deleteGoal(userId: string, id: string) {
  const res = await db().delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId))).returning({ id: goals.id });
  if (!res.length) throw notFound("Obiettivo non trovato");
}
