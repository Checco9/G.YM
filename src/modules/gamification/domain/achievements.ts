import { addDaysToKey, weekStartKey } from "@/lib/dates";
import type { PREvent } from "@/modules/stats/domain/records";
import type { HistoricalWorkout } from "@/modules/stats/domain/types";
import { setsVolume, workoutDurationMin } from "@/modules/stats/domain/volume";
import type { Level } from "@/modules/strength/domain/levels";

export type BadgeGroup = "workouts" | "sets" | "volume" | "streak" | "records" | "variety" | "body" | "strength";

export type AchievementContext = {
  /** in ordine cronologico */
  workouts: HistoricalWorkout[];
  prs: PREvent[];
  /** date delle misurazioni del peso ("YYYY-MM-DD"), in ordine */
  weightDates: string[];
  dayOf: (d: Date) => string;
  /** Stato attuale dei livelli; assente = i badge di forza restano bloccati */
  strength?: { exerciseLevels: Level[]; rankedMuscles: number; totalMuscles: number } | null;
};

export type Unlock = { at: Date; workoutId: string | null } | null;
export type Evaluation = { current: number; target: number; unlock: Unlock };

export type BadgeDef = {
  id: string;
  name: string;
  description: string;
  group: BadgeGroup;
  /** posizione nella famiglia (1 = primo traguardo), usata per la grafica */
  tier: number;
  xp: number;
  evaluate: (ctx: AchievementContext) => Evaluation;
};

export type BadgeState = Omit<BadgeDef, "evaluate"> & { unlocked: boolean; current: number; target: number; at: Date | null; workoutId: string | null; percent: number };

// ───────── Calcoli di supporto ─────────

/** Valori per workout calcolati una sola volta per contesto (ogni badge li riutilizza). */
type Shared = { volume: number[]; sets: number[]; streak: ReturnType<typeof streakInfo> };
const shared = new WeakMap<AchievementContext, Shared>();
function sharedOf(ctx: AchievementContext): Shared {
  let s = shared.get(ctx);
  if (!s) {
    s = {
      volume: ctx.workouts.map((w) => w.exercises.reduce((n, e) => n + setsVolume(e.sets), 0)),
      sets: ctx.workouts.map((w) => w.exercises.reduce((n, e) => n + e.sets.length, 0)),
      streak: streakInfo(ctx),
    };
    shared.set(ctx, s);
  }
  return s;
}

/** Primo workout in cui un contatore cumulativo raggiunge la soglia. */
function cumulativeUnlock(ctx: AchievementContext, target: number, values: number[]): Evaluation {
  let sum = 0;
  let unlock: Unlock = null;
  ctx.workouts.forEach((w, i) => {
    sum += values[i];
    if (!unlock && sum >= target) unlock = { at: w.endedAt ?? w.startedAt, workoutId: w.id };
  });
  return { current: sum, target, unlock };
}

export function streakInfo(ctx: Pick<AchievementContext, "workouts" | "dayOf">) {
  const firstOfWeek = new Map<string, HistoricalWorkout>();
  for (const w of ctx.workouts) {
    const wk = weekStartKey(ctx.dayOf(w.startedAt));
    if (!firstOfWeek.has(wk)) firstOfWeek.set(wk, w);
  }
  const weeks = [...firstOfWeek.keys()].sort();
  const reached = new Map<number, HistoricalWorkout>();
  let run = 0;
  let best = 0;
  weeks.forEach((wk, i) => {
    run = i > 0 && addDaysToKey(weeks[i - 1], 7) === wk ? run + 1 : 1;
    best = Math.max(best, run);
    if (!reached.has(run)) reached.set(run, firstOfWeek.get(wk)!);
  });
  return { best, reached };
}

// ───────── Definizioni ─────────

const list: BadgeDef[] = [];
const add = (def: BadgeDef) => list.push(def);

const WORKOUTS: [number, string, number][] = [
  [1, "Primo allenamento", 20],
  [10, "Dieci allenamenti", 40],
  [25, "Venticinque allenamenti", 60],
  [50, "Cinquanta allenamenti", 100],
  [100, "Cento allenamenti", 150],
  [250, "Duecentocinquanta allenamenti", 250],
  [500, "Cinquecento allenamenti", 400],
];
WORKOUTS.forEach(([n, name, xp], i) =>
  add({
    id: `workouts-${n}`,
    name,
    description: n === 1 ? "Termina il tuo primo allenamento." : `Termina ${n} allenamenti.`,
    group: "workouts",
    tier: i + 1,
    xp,
    evaluate: (ctx) => {
      const w = ctx.workouts[n - 1];
      return { current: ctx.workouts.length, target: n, unlock: w ? { at: w.endedAt ?? w.startedAt, workoutId: w.id } : null };
    },
  }),
);

const SETS: [number, string, number][] = [
  [100, "Cento serie", 30],
  [500, "Cinquecento serie", 60],
  [1000, "Mille serie", 120],
  [5000, "Cinquemila serie", 300],
];
SETS.forEach(([n, name, xp], i) =>
  add({
    id: `sets-${n}`,
    name,
    description: `Completa ${n} serie in totale.`,
    group: "sets",
    tier: i + 1,
    xp,
    evaluate: (ctx) => cumulativeUnlock(ctx, n, sharedOf(ctx).sets),
  }),
);

const VOLUME: [number, string, number][] = [
  [10_000, "10 tonnellate", 30],
  [50_000, "50 tonnellate", 60],
  [100_000, "100 tonnellate", 120],
  [250_000, "250 tonnellate", 200],
  [500_000, "500 tonnellate", 300],
  [1_000_000, "Un milione di chili", 500],
];
VOLUME.forEach(([n, name, xp], i) =>
  add({
    id: `volume-${n}`,
    name,
    description: `Solleva ${n.toLocaleString("it-IT")} kg di volume totale.`,
    group: "volume",
    tier: i + 1,
    xp,
    evaluate: (ctx) => cumulativeUnlock(ctx, n, sharedOf(ctx).volume),
  }),
);

const STREAK: [number, string, number][] = [
  [2, "Due settimane di fila", 30],
  [4, "Un mese di costanza", 80],
  [8, "Otto settimane di fila", 150],
  [12, "Tre mesi di costanza", 250],
  [26, "Mezzo anno senza saltare", 500],
  [52, "Un anno intero", 1000],
];
STREAK.forEach(([n, name, xp], i) =>
  add({
    id: `streak-${n}`,
    name,
    description: `Allenati almeno una volta a settimana per ${n} settimane consecutive.`,
    group: "streak",
    tier: i + 1,
    xp,
    evaluate: (ctx) => {
      const { best, reached } = sharedOf(ctx).streak;
      const w = reached.get(n);
      return { current: best, target: n, unlock: w ? { at: w.startedAt, workoutId: w.id } : null };
    },
  }),
);

const RECORDS: [number, string, number][] = [
  [1, "Primo record", 20],
  [10, "Dieci record", 60],
  [25, "Venticinque record", 120],
  [50, "Cinquanta record", 200],
  [100, "Cento record", 350],
];
RECORDS.forEach(([n, name, xp], i) =>
  add({
    id: `records-${n}`,
    name,
    description: n === 1 ? "Batti un tuo record personale." : `Batti ${n} record personali.`,
    group: "records",
    tier: i + 1,
    xp,
    evaluate: (ctx) => {
      const p = ctx.prs[n - 1];
      return { current: ctx.prs.length, target: n, unlock: p ? { at: p.date, workoutId: p.workoutId } : null };
    },
  }),
);

const VARIETY: [number, string, number][] = [
  [10, "Dieci esercizi diversi", 30],
  [25, "Venticinque esercizi diversi", 80],
  [50, "Cinquanta esercizi diversi", 160],
];
VARIETY.forEach(([n, name, xp], i) =>
  add({
    id: `variety-${n}`,
    name,
    description: `Registra ${n} esercizi diversi.`,
    group: "variety",
    tier: i + 1,
    xp,
    evaluate: (ctx) => {
      const seen = new Set<string>();
      let unlock: Unlock = null;
      for (const w of ctx.workouts) {
        for (const e of w.exercises) seen.add(e.exerciseId);
        if (!unlock && seen.size >= n) unlock = { at: w.endedAt ?? w.startedAt, workoutId: w.id };
      }
      return { current: seen.size, target: n, unlock };
    },
  }),
);

add({
  id: "long-session",
  name: "Maratoneta",
  description: "Completa un allenamento di almeno 90 minuti.",
  group: "workouts",
  tier: 8,
  xp: 50,
  evaluate: (ctx) => {
    let max = 0;
    let unlock: Unlock = null;
    for (const w of ctx.workouts) {
      const m = workoutDurationMin(w) ?? 0;
      max = Math.max(max, m);
      if (!unlock && m >= 90) unlock = { at: w.endedAt ?? w.startedAt, workoutId: w.id };
    }
    return { current: Math.min(max, 90), target: 90, unlock };
  },
});

const BODY: [number, string, number][] = [
  [1, "Sulla bilancia", 10],
  [10, "Dieci pesate", 40],
  [30, "Trenta pesate", 100],
];
BODY.forEach(([n, name, xp], i) =>
  add({
    id: `weight-${n}`,
    name,
    description: n === 1 ? "Registra il tuo peso corporeo." : `Registra ${n} misurazioni del peso.`,
    group: "body",
    tier: i + 1,
    xp,
    evaluate: (ctx) => {
      const d = ctx.weightDates[n - 1];
      return { current: ctx.weightDates.length, target: n, unlock: d ? { at: new Date(`${d}T12:00:00Z`), workoutId: null } : null };
    },
  }),
);

// Badge di forza: dipendono dallo stato attuale (peso corporeo e livelli), quindi non danno XP,
// altrimenti l'XP potrebbe scendere se cambia il peso.
const rank = { intermediate: 2, advanced: 3, elite: 4 } as const;
(
  [
    ["intermediate", "Livello intermedio", "Raggiungi il livello Intermedio in un esercizio."],
    ["advanced", "Livello avanzato", "Raggiungi il livello Avanzato in un esercizio."],
    ["elite", "Livello elite", "Raggiungi il livello Elite in un esercizio."],
  ] as const
).forEach(([lvl, name, description], i) =>
  add({
    id: `strength-${lvl}`,
    name,
    description,
    group: "strength",
    tier: i + 1,
    xp: 0,
    evaluate: (ctx) => {
      const order = ["unranked", "beginner", "intermediate", "advanced", "elite"];
      const n = ctx.strength ? ctx.strength.exerciseLevels.filter((l) => order.indexOf(l) >= rank[lvl]).length : 0;
      return { current: Math.min(n, 1), target: 1, unlock: n > 0 ? { at: new Date(0), workoutId: null } : null };
    },
  }),
);
add({
  id: "strength-all-muscles",
  name: "Corpo completo",
  description: "Ottieni un livello per ogni gruppo muscolare.",
  group: "strength",
  tier: 4,
  xp: 0,
  evaluate: (ctx) => {
    const s = ctx.strength;
    const total = s?.totalMuscles ?? 1;
    const ranked = s?.rankedMuscles ?? 0;
    return { current: ranked, target: total, unlock: s && ranked >= total ? { at: new Date(0), workoutId: null } : null };
  },
});

export const BADGE_DEFS: BadgeDef[] = list;

export function evaluateBadges(ctx: AchievementContext): BadgeState[] {
  return BADGE_DEFS.map(({ evaluate, ...def }) => {
    const e = evaluate(ctx);
    const unlocked = e.unlock !== null;
    return {
      ...def,
      unlocked,
      current: e.current,
      target: e.target,
      // le date "sconosciute" dei badge di forza (epoch) non vanno mostrate
      at: e.unlock && e.unlock.at.getTime() > 0 ? e.unlock.at : null,
      workoutId: e.unlock?.workoutId ?? null,
      percent: unlocked ? 100 : Math.max(0, Math.min(99, Math.floor((e.current / e.target) * 100))),
    };
  });
}

export const BADGE_GROUP_LABEL: Record<BadgeGroup, string> = {
  workouts: "Allenamenti",
  sets: "Serie",
  volume: "Volume",
  streak: "Costanza",
  records: "Record",
  variety: "Varietà",
  body: "Corpo",
  strength: "Forza",
};
