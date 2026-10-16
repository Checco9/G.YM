import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { addDaysToKey, zonedToUtc } from "@/lib/dates";
import { badRequest } from "@/lib/errors";
import { runs } from "@/db/schema";
import type { SessionUser } from "@/modules/auth/session";
import { listWeights } from "@/modules/body/service";
import { runCalories, weightOn, workoutCalories } from "@/modules/stats/domain/calories";

/** Calorie stimate bruciate in un giorno (allenamenti con i pesi e corse). Calcolo teorico: vedi `calories.ts`. */
export async function getDayActivity(user: SessionUser, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest("Data non valida");
  const from = zonedToUtc(date, "00:00", user.timezone);
  const to = zonedToUtc(addDaysToKey(date, 1), "00:00", user.timezone);
  const [workoutRows, runRows, weights] = await Promise.all([
    db().execute(sql`
      select extract(epoch from (w.ended_at - w.started_at)) / 60 as minutes,
        (select count(*)::int from sets s join workout_exercises we on we.id = s.workout_exercise_id where we.workout_id = w.id and s.completed) as sets
      from workouts w
      where w.user_id = ${user.id} and w.status = 'completed' and w.started_at >= ${from.toISOString()}::timestamptz and w.started_at < ${to.toISOString()}::timestamptz`),
    db()
      .select({ distanceM: runs.distanceM, elapsedS: runs.elapsedS })
      .from(runs)
      .where(and(eq(runs.userId, user.id), eq(runs.status, "completed"), gte(runs.startedAt, from), lt(runs.startedAt, to))),
    listWeights(user.id),
  ]);
  const weightKg = weightOn(weights, date);
  const workoutKcal = (workoutRows as unknown as { minutes: number; sets: number }[]).reduce((n, w) => n + (workoutCalories({ weightKg, durationMin: Number(w.minutes), sets: Number(w.sets) }) ?? 0), 0);
  const runKcal = runRows.reduce((n, r) => n + (runCalories({ weightKg, distanceM: r.distanceM, durationS: r.elapsedS }) ?? 0), 0);
  return {
    workoutKcal,
    runKcal,
    total: workoutKcal + runKcal,
    sessions: (workoutRows as unknown as unknown[]).length + runRows.length,
    weightMissing: weightKg === null,
  };
}
