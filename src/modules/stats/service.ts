import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workouts } from "@/db/schema";
import type { SessionUser } from "@/modules/auth/session";
import { addDaysToKey, daysInMonth, dayKey, monthKey, weekdayOfKey, weekStartKey } from "@/lib/dates";
import { estimateOneRepMax } from "./domain/one-rep-max";
import { computePRTimeline as computePRs, type PREvent } from "./domain/records";
import { averagePerWeek, weeklyStreak } from "./domain/streak";
import { setsVolume, workoutDurationMin, workoutSetCount, workoutVolume } from "./domain/volume";
import type { History } from "./repository";
import type { HistoricalWorkout } from "./domain/types";
import { summarizeWeights, type WeightEntry } from "@/modules/body/service";

/** I PR si calcolano una volta sola per storico (la stessa richiesta li usa in più punti). */
const prCache = new WeakMap<object, PREvent[]>();
export function computePRTimeline(workouts: HistoricalWorkout[]): PREvent[] {
  let r = prCache.get(workouts);
  if (!r) {
    r = computePRs(workouts);
    prCache.set(workouts, r);
  }
  return r;
}

// ───────── Elenco e dettaglio workout ─────────

export type WorkoutListItem = {
  id: string;
  name: string;
  startedAt: string;
  durationMin: number | null;
  exerciseCount: number;
  setCount: number;
  volume: number;
  prCount: number;
};

export function buildWorkoutList(history: History): WorkoutListItem[] {
  const prs = computePRTimeline(history.workouts);
  return [...history.workouts]
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .map((w) => ({
      id: w.id,
      name: w.name,
      startedAt: w.startedAt.toISOString(),
      durationMin: workoutDurationMin(w),
      exerciseCount: w.exercises.length,
      setCount: workoutSetCount(w),
      volume: workoutVolume(w),
      prCount: prs.filter((p) => p.workoutId === w.id).length,
    }));
}

export type WorkoutDetail = {
  id: string;
  name: string;
  startedAt: string;
  durationMin: number | null;
  exerciseCount: number;
  setCount: number;
  volume: number;
  notes: string | null;
  exercises: {
    exerciseId: string;
    name: string;
    sets: { weightKg: number; reps: number }[];
    volume: number;
    pr: { kinds: string[]; weightKg: number; reps: number } | null;
  }[];
  prs: { exerciseName: string; weightKg: number; reps: number; kinds: string[] }[];
};

export function buildWorkoutDetail(history: History, id: string, notes: string | null): WorkoutDetail | null {
  const w = history.workouts.find((x) => x.id === id);
  if (!w) return null;
  const prs = computePRTimeline(history.workouts).filter((p) => p.workoutId === id);
  const exercises = w.exercises.map((e) => {
    const p = prs.find((x) => x.exerciseId === e.exerciseId) ?? null;
    return {
      exerciseId: e.exerciseId,
      name: history.exerciseNames.get(e.exerciseId) ?? "Esercizio",
      sets: e.sets,
      volume: setsVolume(e.sets),
      pr: p ? { kinds: p.kinds, weightKg: p.weightKg, reps: p.reps } : null,
    };
  });
  return {
    id: w.id,
    name: w.name,
    startedAt: w.startedAt.toISOString(),
    durationMin: workoutDurationMin(w),
    exerciseCount: w.exercises.length,
    setCount: workoutSetCount(w),
    volume: workoutVolume(w),
    notes,
    exercises,
    prs: exercises.filter((e) => e.pr).map((e) => ({ exerciseName: e.name, ...e.pr! })),
  };
}

export async function getWorkoutNotes(userId: string, id: string): Promise<string | null> {
  const [w] = await db()
    .select({ notes: workouts.notes })
    .from(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, userId)));
  return w?.notes ?? null;
}

// ───────── Calendario ─────────

export type CalendarData = {
  year: number;
  month: number;
  /** 0 = lunedì */
  firstWeekday: number;
  days: number;
  todayKey: string;
  byDay: Record<string, { id: string; name: string; volume: number; durationMin: number | null }[]>;
  monthCount: number;
  totalCount: number;
  avgPerWeek: number;
  streakWeeks: number;
  weeklyTarget: number;
  weekCount: number;
};

export function buildCalendar(history: History, user: SessionUser, year: number, month: number): CalendarData {
  const tz = user.timezone;
  const todayKey = dayKey(new Date(), tz);
  const mk = `${year}-${String(month).padStart(2, "0")}`;
  const byDay: CalendarData["byDay"] = {};
  const allKeys: string[] = [];
  for (const w of history.workouts) {
    const k = dayKey(w.startedAt, tz);
    allKeys.push(k);
    if (k.startsWith(mk)) {
      (byDay[k] ??= []).push({ id: w.id, name: w.name, volume: workoutVolume(w), durationMin: workoutDurationMin(w) });
    }
  }
  const ws = weekStartKey(todayKey);
  return {
    year,
    month,
    firstWeekday: weekdayOfKey(`${mk}-01`),
    days: daysInMonth(year, month),
    todayKey,
    byDay,
    monthCount: Object.values(byDay).reduce((n, a) => n + a.length, 0),
    totalCount: history.workouts.length,
    avgPerWeek: averagePerWeek(allKeys, todayKey, 8),
    streakWeeks: weeklyStreak(allKeys, todayKey),
    weeklyTarget: user.weeklyTarget,
    weekCount: allKeys.filter((k) => k >= ws && k <= addDaysToKey(ws, 6)).length,
  };
}

// ───────── Dashboard ─────────

export function buildDashboard(history: History, user: SessionUser, weights: WeightEntry[]) {
  const tz = user.timezone;
  const now = new Date();
  const todayKey = dayKey(now, tz);
  const ws = weekStartKey(todayKey);
  const keys = history.workouts.map((w) => dayKey(w.startedAt, tz));
  const weekCount = keys.filter((k) => k >= ws && k <= addDaysToKey(ws, 6)).length;
  const monthCount = keys.filter((k) => k.startsWith(monthKey(now, tz))).length;

  const sorted = [...history.workouts].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  const last = sorted[0] ?? null;

  const prs = [...computePRTimeline(history.workouts)].sort((a, b) => b.date.getTime() - a.date.getTime());
  const lastPr = prs[0] ?? null;

  // volume ultimi 7 giorni rispetto ai 7 precedenti
  const d7 = new Date(now.getTime() - 7 * 86400000);
  const d14 = new Date(now.getTime() - 14 * 86400000);
  const vol = (from: Date, to: Date) =>
    history.workouts.filter((w) => w.startedAt >= from && w.startedAt < to).reduce((s, w) => s + workoutVolume(w), 0);
  const v1 = vol(d7, now);
  const v0 = vol(d14, d7);
  const volumeChange = v0 > 0 ? Math.round(((v1 - v0) / v0) * 100) : null;

  return {
    weekCount,
    weeklyTarget: user.weeklyTarget,
    monthCount,
    streakWeeks: weeklyStreak(keys, todayKey),
    weight: summarizeWeights(weights, 7),
    last: last
      ? {
          id: last.id,
          name: last.name,
          endedAt: (last.endedAt ?? last.startedAt).toISOString(),
          volume: workoutVolume(last),
          sets: workoutSetCount(last),
        }
      : null,
    lastPr: lastPr
      ? {
          exerciseId: lastPr.exerciseId,
          exerciseName: history.exerciseNames.get(lastPr.exerciseId) ?? "Esercizio",
          weightKg: lastPr.weightKg,
          reps: lastPr.reps,
          date: lastPr.date.toISOString(),
        }
      : null,
    volumeLast7: v1,
    volumeChange,
  };
}

// ───────── Statistiche e progressi ─────────

export function buildOverviewStats(history: History, weights: WeightEntry[]) {
  const ws = history.workouts;
  const setCount = ws.reduce((n, w) => n + workoutSetCount(w), 0);
  const volume = ws.reduce((n, w) => n + workoutVolume(w), 0);

  const setsPerExercise = new Map<string, number>();
  for (const w of ws) for (const e of w.exercises) setsPerExercise.set(e.exerciseId, (setsPerExercise.get(e.exerciseId) ?? 0) + e.sets.length);
  const top = [...setsPerExercise.entries()].sort((a, b) => b[1] - a[1])[0];

  let longest: { name: string; min: number } | null = null;
  for (const w of ws) {
    const m = workoutDurationMin(w);
    if (m !== null && (!longest || m > longest.min)) longest = { name: w.name, min: m };
  }

  // miglior PR: il serie con il 1RM stimato più alto in assoluto
  let best: { exerciseId: string; weightKg: number; reps: number; e: number } | null = null;
  for (const w of ws)
    for (const ex of w.exercises)
      for (const s of ex.sets) {
        const e = estimateOneRepMax(s.weightKg, s.reps);
        if (e !== null && (!best || e > best.e)) best = { exerciseId: ex.exerciseId, ...s, e };
      }

  const summary = summarizeWeights(weights);
  return {
    workouts: ws.length,
    sets: setCount,
    volume,
    exercisesRecorded: setsPerExercise.size,
    mostTrained: top ? { name: history.exerciseNames.get(top[0]) ?? "Esercizio", sets: top[1] } : null,
    longest,
    bestPr: best ? { name: history.exerciseNames.get(best.exerciseId) ?? "Esercizio", weightKg: best.weightKg, reps: best.reps } : null,
    weight: summary,
  };
}

export type WeeklyPoint = { label: string; weekStart: string; volume: number; workouts: number };

export function buildWeeklySeries(history: History, user: SessionUser, weeks = 12): WeeklyPoint[] {
  const todayKey = dayKey(new Date(), user.timezone);
  const start = addDaysToKey(weekStartKey(todayKey), -7 * (weeks - 1));
  const out: WeeklyPoint[] = Array.from({ length: weeks }, (_, i) => {
    const k = addDaysToKey(start, i * 7);
    return { label: k.slice(8) + "/" + k.slice(5, 7), weekStart: k, volume: 0, workouts: 0 };
  });
  for (const w of history.workouts) {
    const k = weekStartKey(dayKey(w.startedAt, user.timezone));
    const p = out.find((x) => x.weekStart === k);
    if (p) {
      p.volume += workoutVolume(w);
      p.workouts += 1;
    }
  }
  return out;
}

export type ExerciseSession = {
  workoutId: string;
  date: string;
  sets: { weightKg: number; reps: number }[];
  top: { weightKg: number; reps: number };
  estimatedOneRepMax: number | null;
  volume: number;
};

export function buildExerciseProgress(history: History, exerciseId: string): { name: string; sessions: ExerciseSession[]; prs: PREvent[] } | null {
  const sessions: ExerciseSession[] = [];
  for (const w of history.workouts) {
    const ex = w.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex || !ex.sets.length) continue;
    let top = ex.sets[0];
    let topE = estimateOneRepMax(top.weightKg, top.reps) ?? 0;
    for (const s of ex.sets) {
      const e = estimateOneRepMax(s.weightKg, s.reps) ?? 0;
      if (e > topE || (e === topE && s.weightKg > top.weightKg)) {
        top = s;
        topE = e;
      }
    }
    sessions.push({
      workoutId: w.id,
      date: w.startedAt.toISOString(),
      sets: ex.sets,
      top,
      estimatedOneRepMax: estimateOneRepMax(top.weightKg, top.reps),
      volume: setsVolume(ex.sets),
    });
  }
  const name = history.exerciseNames.get(exerciseId);
  if (!name) return null;
  const prs = computePRTimeline(history.workouts).filter((p) => p.exerciseId === exerciseId);
  return { name, sessions, prs };
}

export function listTrainedExercises(history: History) {
  const map = new Map<string, { exerciseId: string; name: string; sessions: number; lastAt: Date; bestE: number }>();
  for (const w of history.workouts)
    for (const ex of w.exercises) {
      const cur = map.get(ex.exerciseId) ?? {
        exerciseId: ex.exerciseId,
        name: history.exerciseNames.get(ex.exerciseId) ?? "Esercizio",
        sessions: 0,
        lastAt: w.startedAt,
        bestE: 0,
      };
      cur.sessions += 1;
      if (w.startedAt > cur.lastAt) cur.lastAt = w.startedAt;
      for (const s of ex.sets) cur.bestE = Math.max(cur.bestE, estimateOneRepMax(s.weightKg, s.reps) ?? 0);
      map.set(ex.exerciseId, cur);
    }
  return [...map.values()].sort((a, b) => b.sessions - a.sessions || b.lastAt.getTime() - a.lastAt.getTime());
}

export function listAllPRs(history: History) {
  return [...computePRTimeline(history.workouts)]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((p) => ({ ...p, date: p.date.toISOString(), exerciseName: history.exerciseNames.get(p.exerciseId) ?? "Esercizio" }));
}

export type { HistoricalWorkout };
