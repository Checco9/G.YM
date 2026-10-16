import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { addDaysToKey, dayKey, zonedToUtc } from "@/lib/dates";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { runs } from "@/db/schema";
import type { SessionUser } from "@/modules/auth/session";
import { finishRunSchema, manualRunSchema, runStateSchema, startRunSchema } from "./schemas";

export type RunView = {
  id: string;
  status: "in_progress" | "completed";
  kind: "outdoor" | "treadmill";
  source: "manual" | "timer" | "gps";
  startedAt: string;
  endedAt: string | null;
  /** secondi accumulati; se `timerStartedAt` è valorizzato il cronometro sta correndo da quell'istante */
  elapsedS: number;
  timerStartedAt: string | null;
  distanceM: number;
  effort: number | null;
  notes: string | null;
};

const view = (r: typeof runs.$inferSelect): RunView => ({
  id: r.id,
  status: r.status,
  kind: r.kind,
  source: r.source,
  startedAt: r.startedAt.toISOString(),
  endedAt: r.endedAt?.toISOString() ?? null,
  elapsedS: r.elapsedS,
  timerStartedAt: r.timerStartedAt?.toISOString() ?? null,
  distanceM: r.distanceM,
  effort: r.effort,
  notes: r.notes,
});

export async function getRun(userId: string, id: string): Promise<RunView | null> {
  const [r] = await db().select().from(runs).where(and(eq(runs.id, id), eq(runs.userId, userId))).limit(1);
  return r ? view(r) : null;
}

export async function getActiveRun(userId: string): Promise<RunView | null> {
  const [r] = await db().select().from(runs).where(and(eq(runs.userId, userId), eq(runs.status, "in_progress"))).orderBy(desc(runs.startedAt)).limit(1);
  return r ? view(r) : null;
}

/** Avvia una corsa. Se ce n'è già una in corso restituisce quella (come per gli allenamenti). */
export async function startRun(userId: string, input: unknown) {
  const { kind } = startRunSchema.parse(input ?? {});
  const active = await getActiveRun(userId);
  if (active) return { id: active.id, resumed: true };
  const [r] = await db().insert(runs).values({ userId, kind, source: "timer" }).returning({ id: runs.id });
  return { id: r.id, resumed: false };
}

/** Salvataggio continuo del cronometro e della distanza. */
export async function saveRunState(userId: string, id: string, input: unknown) {
  const s = runStateSchema.parse(input);
  const res = await db()
    .update(runs)
    .set({ kind: s.kind, elapsedS: s.elapsedS, timerStartedAt: s.running ? new Date() : null, distanceM: s.distanceM, notes: s.notes ?? null, updatedAt: new Date() })
    .where(and(eq(runs.id, id), eq(runs.userId, userId), eq(runs.status, "in_progress")))
    .returning({ id: runs.id });
  if (!res.length) {
    const existing = await getRun(userId, id);
    throw existing ? conflict("Corsa già conclusa") : notFound("Corsa non trovata");
  }
}

export async function finishRun(userId: string, id: string, input: unknown) {
  const f = finishRunSchema.parse(input);
  const res = await db()
    .update(runs)
    .set({ status: "completed", endedAt: new Date(), kind: f.kind, elapsedS: f.elapsedS, timerStartedAt: null, distanceM: f.distanceM, effort: f.effort ?? null, notes: f.notes ?? null, updatedAt: new Date() })
    .where(and(eq(runs.id, id), eq(runs.userId, userId), eq(runs.status, "in_progress")))
    .returning({ id: runs.id });
  if (!res.length) {
    const existing = await getRun(userId, id);
    throw existing ? conflict("Corsa già conclusa") : notFound("Corsa non trovata");
  }
  return { id };
}

/** Registra una corsa già fatta (altrove o senza cronometro). */
export async function createManualRun(user: SessionUser, input: unknown) {
  const d = manualRunSchema.parse(input);
  const today = dayKey(new Date(), user.timezone);
  if (d.date > addDaysToKey(today, 0) || d.date < addDaysToKey(today, -730)) throw badRequest("Data non valida");
  const startedAt = zonedToUtc(d.date, d.time, user.timezone);
  if (startedAt.getTime() > Date.now() + 60000) throw badRequest("La corsa non può essere nel futuro");
  const [r] = await db()
    .insert(runs)
    .values({
      userId: user.id,
      status: "completed",
      kind: d.kind,
      source: "manual",
      startedAt,
      endedAt: new Date(startedAt.getTime() + d.durationS * 1000),
      elapsedS: d.durationS,
      distanceM: d.distanceM,
      effort: d.effort ?? null,
      notes: d.notes ?? null,
    })
    .returning({ id: runs.id });
  return { id: r.id };
}

export async function deleteRun(userId: string, id: string) {
  const res = await db().delete(runs).where(and(eq(runs.id, id), eq(runs.userId, userId))).returning({ id: runs.id });
  if (!res.length) throw notFound("Corsa non trovata");
}

export async function listCompletedRuns(userId: string, limit = 500): Promise<RunView[]> {
  const rows = await db().select().from(runs).where(and(eq(runs.userId, userId), eq(runs.status, "completed"))).orderBy(desc(runs.startedAt)).limit(limit);
  return rows.map(view);
}
