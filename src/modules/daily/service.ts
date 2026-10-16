import { and, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { addDaysToKey, dayKey } from "@/lib/dates";
import { badRequest } from "@/lib/errors";
import { dailyLogs, profiles } from "@/db/schema";
import type { SessionUser } from "@/modules/auth/session";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida");

/** Campi assenti = invariati, null = cancellati. */
export const dailySchema = z.object({
  date,
  steps: z.number().int().min(0, "Valore non valido").max(100000, "Valore non valido").nullish(),
  sleepMinutes: z.number().int().min(0, "Valore non valido").max(1440, "Valore non valido").nullish(),
  sleepQuality: z.number().int().min(1).max(5).nullish(),
});

export const dailyGoalsSchema = z.object({
  stepsGoal: z.number().int().min(1000, "Minimo 1.000 passi").max(50000, "Massimo 50.000 passi"),
  sleepGoalMin: z.number().int().min(240, "Minimo 4 ore").max(720, "Massimo 12 ore"),
});

export type DailyLog = { date: string; steps: number | null; sleepMinutes: number | null; sleepQuality: number | null };

export async function getDaily(userId: string, day: string): Promise<DailyLog> {
  const [r] = await db().select().from(dailyLogs).where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.loggedOn, day))).limit(1);
  return { date: day, steps: r?.steps ?? null, sleepMinutes: r?.sleepMinutes ?? null, sleepQuality: r?.sleepQuality ?? null };
}

export async function saveDaily(user: SessionUser, input: unknown): Promise<DailyLog> {
  const d = dailySchema.parse(input);
  const today = dayKey(new Date(), user.timezone);
  if (d.date > addDaysToKey(today, 0) || d.date < addDaysToKey(today, -400)) throw badRequest("Data non valida");
  const change: Partial<typeof dailyLogs.$inferInsert> = {};
  if (d.steps !== undefined) change.steps = d.steps;
  if (d.sleepMinutes !== undefined) change.sleepMinutes = d.sleepMinutes;
  if (d.sleepQuality !== undefined) change.sleepQuality = d.sleepQuality;
  await db()
    .insert(dailyLogs)
    .values({ userId: user.id, loggedOn: d.date, ...change })
    .onConflictDoUpdate({ target: [dailyLogs.userId, dailyLogs.loggedOn], set: { ...change, updatedAt: new Date() } });
  return getDaily(user.id, d.date);
}

export async function getDailyRange(user: SessionUser, days: number): Promise<DailyLog[]> {
  const today = dayKey(new Date(), user.timezone);
  const from = addDaysToKey(today, -(days - 1));
  const rows = await db().select().from(dailyLogs).where(and(eq(dailyLogs.userId, user.id), gte(dailyLogs.loggedOn, from)));
  return Array.from({ length: days }, (_, i) => {
    const day = addDaysToKey(from, i);
    const r = rows.find((x) => x.loggedOn === day);
    return { date: day, steps: r?.steps ?? null, sleepMinutes: r?.sleepMinutes ?? null, sleepQuality: r?.sleepQuality ?? null };
  });
}

export async function saveDailyGoals(userId: string, input: unknown) {
  const g = dailyGoalsSchema.parse(input);
  await db().update(profiles).set({ stepsGoal: g.stepsGoal, sleepGoalMin: g.sleepGoalMin, updatedAt: new Date() }).where(eq(profiles.userId, userId));
}
