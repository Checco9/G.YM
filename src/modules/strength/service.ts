import { MUSCLES } from "@/config/muscles";
import { listExerciseMuscleLinks, listStandards, listVisibleExercises } from "@/modules/exercises/repository";
import { latestWeight } from "@/modules/body/service";
import type { SessionUser } from "@/modules/auth/session";
import type { History } from "@/modules/stats/repository";
import { estimateOneRepMax } from "@/modules/stats/domain/one-rep-max";
import { addDaysToKey, dayKey } from "@/lib/dates";
import {
  classify,
  levelIndex,
  muscleLevel,
  type Level,
  type Thresholds,
} from "./domain/levels";

export type UnrankedReason = "no_bodyweight" | "no_sex" | "no_standard" | "no_data";

export type ExerciseStrength = {
  exerciseId: string;
  name: string;
  level: Level;
  reason: UnrankedReason | null;
  estimatedOneRepMax: number | null;
  bestSet: { weightKg: number; reps: number } | null;
  thresholds: Thresholds | null;
};

export type MuscleStrength = {
  muscleId: string;
  name: string;
  level: Level;
  exercises: { exerciseId: string; name: string; level: Level; role: "primary" | "secondary"; trained: boolean }[];
  best: { exerciseName: string; weightKg: number; reps: number } | null;
  /** variazione percentuale del 1RM stimato negli ultimi 30 giorni, null se non calcolabile */
  progression30d: number | null;
};

export type StrengthOverview = {
  bodyWeightKg: number | null;
  exercises: ExerciseStrength[];
  muscles: MuscleStrength[];
};

type Stat = { best: number | null; base: number | null; recent: boolean; bestSet: { weightKg: number; reps: number; e: number } | null };

/** Una sola passata sullo storico: 1RM migliore, migliore prima della finestra, miglior serie, allenato di recente. */
function collectStats(history: History, cutoff: Date) {
  const stats = new Map<string, Stat>();
  for (const w of history.workouts) {
    const isRecent = w.startedAt >= cutoff;
    for (const ex of w.exercises) {
      const st = stats.get(ex.exerciseId) ?? { best: null, base: null, recent: false, bestSet: null };
      if (isRecent) st.recent = true;
      for (const s of ex.sets) {
        const e = estimateOneRepMax(s.weightKg, s.reps);
        if (e !== null) {
          if (st.best === null || e > st.best) st.best = e;
          if (!isRecent && (st.base === null || e > st.base)) st.base = e;
        }
        const k = e ?? 0;
        if (!st.bestSet || k > st.bestSet.e || (k === st.bestSet.e && s.weightKg > st.bestSet.weightKg)) {
          st.bestSet = { weightKg: s.weightKg, reps: s.reps, e: k };
        }
      }
      stats.set(ex.exerciseId, st);
    }
  }
  return stats;
}

export async function getStrengthOverview(user: SessionUser, history: History): Promise<StrengthOverview> {
  const [exList, standards, links, bodyWeightKg] = await Promise.all([
    listVisibleExercises(user.id),
    listStandards(),
    listExerciseMuscleLinks(),
    latestWeight(user.id),
  ]);

  const todayKey = dayKey(new Date(), user.timezone);
  const cutoff = new Date(`${addDaysToKey(todayKey, -30)}T00:00:00Z`);
  const stats = collectStats(history, cutoff);

  const exerciseStrength = new Map<string, ExerciseStrength>();
  for (const ex of exList) {
    const rows = user.sex ? standards.filter((s) => s.exerciseId === ex.id && s.sex === user.sex) : [];
    const thresholds = rows.length
      ? (Object.fromEntries(rows.map((r) => [r.level, r.minRatio])) as Thresholds)
      : null;
    const e1rm = stats.get(ex.id)?.best ?? null;
    const level = classify({ estimatedOneRepMax: e1rm, bodyWeightKg, thresholds });
    let reason: UnrankedReason | null = null;
    if (level === "unranked") {
      if (!thresholds && user.sex) reason = "no_standard";
      else if (!user.sex) reason = "no_sex";
      else if (!bodyWeightKg) reason = "no_bodyweight";
      else reason = "no_data";
      if (!thresholds && user.sex && !e1rm) reason = "no_standard";
    }
    exerciseStrength.set(ex.id, {
      exerciseId: ex.id,
      name: ex.name,
      level,
      reason,
      estimatedOneRepMax: e1rm,
      bestSet: stats.get(ex.id)?.bestSet ? { weightKg: stats.get(ex.id)!.bestSet!.weightKg, reps: stats.get(ex.id)!.bestSet!.reps } : null,
      thresholds,
    });
  }

  const muscles: MuscleStrength[] = MUSCLES.map((m) => {
    const ml = links.filter((l) => l.muscleId === m.id && exerciseStrength.has(l.exerciseId));
    const entries = ml.map((l) => ({
      exerciseId: l.exerciseId,
      role: l.role,
      level: exerciseStrength.get(l.exerciseId)!.level,
    }));
    const level = muscleLevel(entries);

    const exercises = ml
      .map((l) => {
        const es = exerciseStrength.get(l.exerciseId)!;
        return { exerciseId: es.exerciseId, name: es.name, level: es.level, role: l.role, trained: es.bestSet !== null };
      })
      .sort(
        (a, b) =>
          Number(b.role === "primary") - Number(a.role === "primary") ||
          Number(b.trained) - Number(a.trained) ||
          levelIndex(b.level) - levelIndex(a.level) ||
          a.name.localeCompare(b.name),
      );

    // miglior risultato tra gli esercizi primari: prima il livello, poi il 1RM stimato
    let best: MuscleStrength["best"] = null;
    let bestKey = -1;
    for (const e of ml.filter((l) => l.role === "primary")) {
      const es = exerciseStrength.get(e.exerciseId)!;
      if (!es.bestSet) continue;
      const key = levelIndex(es.level) * 100000 + (es.estimatedOneRepMax ?? 0);
      if (key > bestKey) {
        bestKey = key;
        best = { exerciseName: es.name, ...es.bestSet };
      }
    }

    // progressione: media della variazione del 1RM stimato rispetto a prima della finestra di 30 giorni
    const changes: number[] = [];
    for (const e of ml.filter((l) => l.role === "primary")) {
      const st = stats.get(e.exerciseId);
      if (st?.base && st.best && st.recent) changes.push((st.best / st.base - 1) * 100);
    }
    const progression30d = changes.length ? Math.round(changes.reduce((a, b) => a + b, 0) / changes.length) : null;

    return { muscleId: m.id, name: m.name, level, exercises, best, progression30d };
  });

  return { bodyWeightKg, exercises: [...exerciseStrength.values()], muscles };
}
