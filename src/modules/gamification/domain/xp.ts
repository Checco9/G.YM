import { weekStartKey } from "@/lib/dates";
import type { HistoricalWorkout } from "@/modules/stats/domain/types";

/**
 * Regole dell'XP (V2). L'XP non è salvato: si ricalcola sempre dallo storico, quindi
 * cancellare un allenamento o cambiare una regola mantiene tutto coerente.
 * Anti-abuso: serve un minimo di serie per guadagnare XP da un workout, conta un solo
 * workout al giorno e le serie contano fino a un massimo per allenamento.
 */
export const XP_RULES = {
  perWorkout: 50,
  minSetsForWorkout: 3,
  perSet: 2,
  maxSetsPerWorkout: 30,
  perPr: 40,
  perFullWeek: 60,
  fullWeekMinWorkouts: 3,
  perChallenge: 150,
} as const;

export type XpBreakdown = {
  workouts: number;
  sets: number;
  records: number;
  weeks: number;
  badges: number;
  challenges: number;
  total: number;
};

export function computeXp(input: {
  workouts: HistoricalWorkout[];
  prCount: number;
  badgeXp: number;
  challengesCompleted: number;
  dayOf: (d: Date) => string;
}): XpBreakdown {
  const sorted = [...input.workouts].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  const seenDays = new Set<string>();
  let workouts = 0;
  let sets = 0;
  const perWeek = new Map<string, number>();

  for (const w of sorted) {
    const day = input.dayOf(w.startedAt);
    const setCount = w.exercises.reduce((n, e) => n + e.sets.length, 0);
    perWeek.set(weekStartKey(day), (perWeek.get(weekStartKey(day)) ?? 0) + 1);
    if (setCount < XP_RULES.minSetsForWorkout || seenDays.has(day)) continue;
    seenDays.add(day);
    workouts += XP_RULES.perWorkout;
    sets += Math.min(setCount, XP_RULES.maxSetsPerWorkout) * XP_RULES.perSet;
  }

  const fullWeeks = [...perWeek.values()].filter((n) => n >= XP_RULES.fullWeekMinWorkouts).length;
  const records = input.prCount * XP_RULES.perPr;
  const weeks = fullWeeks * XP_RULES.perFullWeek;
  const challenges = input.challengesCompleted * XP_RULES.perChallenge;
  return {
    workouts,
    sets,
    records,
    weeks,
    badges: input.badgeXp,
    challenges,
    total: workouts + sets + records + weeks + input.badgeXp + challenges,
  };
}

// ───────── Livelli dell'account ─────────

/** XP cumulativo necessario per raggiungere un livello: 0, 100, 400, 900, 1600... */
export const xpForLevel = (level: number) => 100 * (level - 1) * (level - 1);

const TITLES: [number, string][] = [
  [1, "Matricola"],
  [3, "Frequentatore"],
  [5, "Costante"],
  [8, "Atleta"],
  [12, "Veterano"],
  [17, "Maestro di ghisa"],
  [25, "Leggenda"],
];

export type LevelInfo = {
  level: number;
  title: string;
  xp: number;
  xpIntoLevel: number;
  xpForNext: number;
  percent: number;
};

export function levelFromXp(xp: number): LevelInfo {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const title = [...TITLES].reverse().find(([from]) => level >= from)![1];
  return {
    level,
    title,
    xp,
    xpIntoLevel: xp - base,
    xpForNext: next - base,
    percent: Math.min(100, Math.round(((xp - base) / (next - base)) * 100)),
  };
}
