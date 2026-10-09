import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { bodyWeightEntries } from "@/db/schema";
import { addDaysToKey, dayKey } from "@/lib/dates";

export const weightSchema = z.object({
  measuredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida"),
  weightKg: z.number().min(20, "Peso non valido").max(400, "Peso non valido"),
});

export type WeightEntry = { id: string; measuredOn: string; weightKg: number };

export async function listWeights(userId: string): Promise<WeightEntry[]> {
  return db()
    .select({ id: bodyWeightEntries.id, measuredOn: bodyWeightEntries.measuredOn, weightKg: bodyWeightEntries.weightKg })
    .from(bodyWeightEntries)
    .where(eq(bodyWeightEntries.userId, userId))
    .orderBy(asc(bodyWeightEntries.measuredOn), asc(bodyWeightEntries.createdAt));
}

export async function latestWeight(userId: string): Promise<number | null> {
  const [r] = await db()
    .select({ w: bodyWeightEntries.weightKg })
    .from(bodyWeightEntries)
    .where(eq(bodyWeightEntries.userId, userId))
    .orderBy(desc(bodyWeightEntries.measuredOn), desc(bodyWeightEntries.createdAt))
    .limit(1);
  return r?.w ?? null;
}

export async function addWeight(userId: string, input: unknown) {
  const d = weightSchema.parse(input);
  const [r] = await db().insert(bodyWeightEntries).values({ userId, ...d }).returning({ id: bodyWeightEntries.id });
  return { id: r.id };
}

export async function updateWeight(userId: string, id: string, input: unknown) {
  const d = weightSchema.parse(input);
  const res = await db()
    .update(bodyWeightEntries)
    .set(d)
    .where(and(eq(bodyWeightEntries.id, id), eq(bodyWeightEntries.userId, userId)))
    .returning({ id: bodyWeightEntries.id });
  if (!res.length) throw notFound("Misurazione non trovata");
}

export async function deleteWeight(userId: string, id: string) {
  const res = await db()
    .delete(bodyWeightEntries)
    .where(and(eq(bodyWeightEntries.id, id), eq(bodyWeightEntries.userId, userId)))
    .returning({ id: bodyWeightEntries.id });
  if (!res.length) throw notFound("Misurazione non trovata");
}

/** Sintesi: peso iniziale, attuale, differenza totale e variazione negli ultimi `days` giorni. */
export function summarizeWeights(entries: WeightEntry[], days = 7) {
  if (!entries.length) return null;
  const first = entries[0];
  const last = entries[entries.length - 1];
  const cutoff = addDaysToKey(last.measuredOn, -days);
  const base = [...entries].reverse().find((e) => e.measuredOn <= cutoff && e.id !== last.id);
  return {
    initial: first.weightKg,
    current: last.weightKg,
    total: Math.round((last.weightKg - first.weightKg) * 100) / 100,
    recent: base ? Math.round((last.weightKg - base.weightKg) * 100) / 100 : null,
  };
}

export const todayKey = (tz: string) => dayKey(new Date(), tz);
