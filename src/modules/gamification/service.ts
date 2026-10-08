import { and, asc, desc, eq, inArray, ne, sql, type AnyColumn } from "drizzle-orm";
import { revalidateTag, unstable_cache } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { badRequest, notFound } from "@/lib/errors";
import { addDaysToKey, dayKey } from "@/lib/dates";
import { bodyWeightEntries, challenges, comments, postReactions, posts, profiles } from "@/db/schema";
import type { WeightEntry } from "@/modules/body/service";
import { listWeights } from "@/modules/body/service";
import type { History } from "@/modules/stats/repository";
import { loadHistories } from "@/modules/stats/repository";
import { computePRTimeline } from "@/modules/stats/service";
import { weeklyStreak } from "@/modules/stats/domain/streak";
import { periodMetrics, PERIOD_DAYS, type Period, type PeriodMetrics } from "./domain/leaderboard";
import { workoutVolume } from "@/modules/stats/domain/volume";
import type { StrengthOverview } from "@/modules/strength/service";
import { evaluateBadges, streakInfo, type BadgeState } from "./domain/achievements";
import { challengeProgress, type ChallengeKind, type ChallengeProgress } from "./domain/challenges";
import { computeXp, levelFromXp, type LevelInfo, type XpBreakdown } from "./domain/xp";

// ───────── Sfide personali ─────────

export const challengeSchema = z.object({
  kind: z.enum(["workouts", "volume", "sets", "prs"]),
  targetValue: z.number().int().min(1).max(1_000_000),
  days: z.number().int().min(1).max(365),
  title: z.string().trim().max(80).optional(),
});

export type ChallengeRow = { id: string; kind: ChallengeKind; title: string; targetValue: number; startsOn: string; endsOn: string };
export type ChallengeView = ChallengeRow & { progress: ChallengeProgress };

export async function listChallengeRows(userId: string): Promise<ChallengeRow[]> {
  return db()
    .select({
      id: challenges.id,
      kind: challenges.kind,
      title: challenges.title,
      targetValue: challenges.targetValue,
      startsOn: challenges.startsOn,
      endsOn: challenges.endsOn,
    })
    .from(challenges)
    .where(eq(challenges.userId, userId))
    .orderBy(desc(challenges.createdAt));
}

const DEFAULT_TITLE: Record<ChallengeKind, (n: number, d: number) => string> = {
  workouts: (n, d) => `${n} allenamenti in ${d} giorni`,
  volume: (n, d) => `${n.toLocaleString("it-IT")} kg di volume in ${d} giorni`,
  sets: (n, d) => `${n} serie in ${d} giorni`,
  prs: (n, d) => `${n} record in ${d} giorni`,
};

export async function createChallenge(userId: string, tz: string, input: unknown) {
  const d = challengeSchema.parse(input);
  const rows = await listChallengeRows(userId);
  const today = dayKey(new Date(), tz);
  if (rows.filter((c) => c.endsOn >= today).length >= 5) throw badRequest("Puoi avere al massimo 5 sfide attive");
  const [r] = await db()
    .insert(challenges)
    .values({
      userId,
      kind: d.kind,
      title: d.title || DEFAULT_TITLE[d.kind](d.targetValue, d.days),
      targetValue: d.targetValue,
      startsOn: today,
      endsOn: addDaysToKey(today, d.days - 1),
    })
    .returning({ id: challenges.id });
  return { id: r.id };
}

export async function deleteChallenge(userId: string, id: string) {
  const res = await db()
    .delete(challenges)
    .where(and(eq(challenges.id, id), eq(challenges.userId, userId)))
    .returning({ id: challenges.id });
  if (!res.length) throw notFound("Sfida non trovata");
}

// ───────── Calcolo complessivo ─────────

export type Gamification = {
  xp: XpBreakdown;
  level: LevelInfo;
  badges: BadgeState[];
  streak: { current: number; best: number };
  challenges: ChallengeView[];
};

type Input = {
  tz: string;
  history: History;
  weights: WeightEntry[];
  challenges: ChallengeRow[];
  strength?: StrengthOverview | null;
};

/** Funzione pura sui dati già caricati: nessun accesso al database. */
export function buildGamification({ tz, history, weights, challenges: rows, strength }: Input): Gamification {
  const dayOf = (d: Date) => dayKey(d, tz);
  const workouts = history.workouts;
  const prs = computePRTimeline(workouts);
  const today = dayKey(new Date(), tz);

  const badges = evaluateBadges({
    workouts,
    prs,
    weightDates: weights.map((w) => w.measuredOn),
    dayOf,
    strength: strength
      ? {
          exerciseLevels: strength.exercises.map((e) => e.level),
          rankedMuscles: strength.muscles.filter((m) => m.level !== "unranked").length,
          totalMuscles: strength.muscles.length,
        }
      : null,
  });

  const views: ChallengeView[] = rows
    .map((c) => ({ ...c, progress: challengeProgress(c, { workouts, prs, dayOf }, today) }))
    .sort((a, b) => order(a.progress.status) - order(b.progress.status) || b.endsOn.localeCompare(a.endsOn));

  const xp = computeXp({
    workouts,
    prCount: prs.length,
    badgeXp: badges.filter((b) => b.unlocked).reduce((n, b) => n + b.xp, 0),
    challengesCompleted: views.filter((c) => c.progress.status === "completed").length,
    dayOf,
  });

  const keys = workouts.map((w) => dayOf(w.startedAt));
  return {
    xp,
    level: levelFromXp(xp.total),
    badges,
    streak: { current: weeklyStreak(keys, today), best: streakInfo({ workouts, dayOf }).best },
    challenges: views,
  };
}

const order = (s: ChallengeProgress["status"]) => (s === "active" ? 0 : s === "completed" ? 1 : 2);

export async function getGamification(userId: string, tz: string, history: History, weights?: WeightEntry[], strength?: StrengthOverview | null) {
  const [w, c] = await Promise.all([weights ? Promise.resolve(weights) : listWeights(userId), listChallengeRows(userId)]);
  return buildGamification({ tz, history, weights: w, challenges: c, strength });
}

/** Cosa ha fruttato un singolo allenamento: XP, eventuale salto di livello e nuovi badge. */
export function buildRewards(input: Input, workoutId: string) {
  const after = buildGamification(input);
  const before = buildGamification({ ...input, history: { ...input.history, workouts: input.history.workouts.filter((w) => w.id !== workoutId) } });
  const volume = input.history.workouts.find((w) => w.id === workoutId);
  return {
    xpGained: after.xp.total - before.xp.total,
    level: after.level,
    leveledUp: after.level.level > before.level.level,
    newBadges: after.badges.filter((b) => b.unlocked && b.workoutId === workoutId),
    volume: volume ? workoutVolume(volume) : 0,
  };
}

// ───────── Classifica locale (solo chi ha scelto di partecipare) ─────────

export type LeaderboardMember = {
  userId: string;
  name: string;
  level: number;
  xp: number;
  streak: number;
  periods: Record<Period, PeriodMetrics & { social: number }>;
};

async function computeLeaderboard(): Promise<LeaderboardMember[]> {
  const people = await db()
    .select({ userId: profiles.userId, name: profiles.displayName, tz: profiles.timezone })
    .from(profiles)
    .where(eq(profiles.leaderboardOptIn, true))
    .limit(30);
  if (!people.length) return [];
  const ids = people.map((p) => p.userId);

  // Tutto in poche query per tutti i partecipanti insieme (non una serie di query per ciascuno).
  const windowCount = (col: AnyColumn, days: number) => sql<number>`count(*) filter (where ${col} >= now() - make_interval(days => ${days}))::int`;
  const [histories, weightRows, challengeRows, reactionRows, commentRows] = await Promise.all([
    loadHistories(ids),
    db().select({ userId: bodyWeightEntries.userId, measuredOn: bodyWeightEntries.measuredOn, weightKg: bodyWeightEntries.weightKg, id: bodyWeightEntries.id }).from(bodyWeightEntries).where(inArray(bodyWeightEntries.userId, ids)).orderBy(asc(bodyWeightEntries.measuredOn)),
    db().select().from(challenges).where(inArray(challenges.userId, ids)),
    db()
      .select({ uid: posts.userId, w: windowCount(postReactions.createdAt, 7), m: windowCount(postReactions.createdAt, 30), a: sql<number>`count(*)::int` })
      .from(postReactions)
      .innerJoin(posts, eq(posts.id, postReactions.postId))
      .where(and(inArray(posts.userId, ids), ne(postReactions.userId, posts.userId)))
      .groupBy(posts.userId),
    db()
      .select({ uid: posts.userId, w: windowCount(comments.createdAt, 7), m: windowCount(comments.createdAt, 30), a: sql<number>`count(*)::int` })
      .from(comments)
      .innerJoin(posts, eq(posts.id, comments.postId))
      .where(and(inArray(posts.userId, ids), ne(comments.userId, posts.userId)))
      .groupBy(posts.userId),
  ]);

  const now = Date.now();
  return people.map((p) => {
    const history = histories.get(p.userId)!;
    const weights = weightRows.filter((w) => w.userId === p.userId).map(({ id, measuredOn, weightKg }) => ({ id, measuredOn, weightKg }));
    const rows = challengeRows.filter((c) => c.userId === p.userId).map((c) => ({ id: c.id, kind: c.kind, title: c.title, targetValue: c.targetValue, startsOn: c.startsOn, endsOn: c.endsOn }));
    const g = buildGamification({ tz: p.tz, history, weights, challenges: rows });
    const prs = computePRTimeline(history.workouts);
    const social = (list: { uid: string; w: number; m: number; a: number }[]) => list.find((x) => x.uid === p.userId) ?? { w: 0, m: 0, a: 0 };
    const rx = social(reactionRows);
    const cm = social(commentRows);
    const metrics = (period: Period) => {
      const days = PERIOD_DAYS[period];
      const since = days ? new Date(now - days * 86400000) : null;
      const soc = period === "week" ? rx.w + cm.w : period === "month" ? rx.m + cm.m : rx.a + cm.a;
      return { ...periodMetrics(history.workouts, prs, since), social: soc };
    };
    return {
      userId: p.userId,
      name: p.name,
      level: g.level.level,
      xp: g.xp.total,
      streak: g.streak.current,
      periods: { week: metrics("week"), month: metrics("month"), all: metrics("all") },
    };
  });
}

/**
 * Classifica in cache, con aggiornamento in background allo scadere dei 5 minuti (stale-while-revalidate):
 * nessuno aspetta il ricalcolo. Si invalida subito solo quando qualcuno entra o esce dalla classifica.
 */
export const getLeaderboard = unstable_cache(computeLeaderboard, ["leaderboard-v2"], {
  revalidate: Number(process.env.LEADERBOARD_TTL_SECONDS) || 300,
  tags: ["leaderboard"],
});

export async function setLeaderboardOptIn(userId: string, optIn: boolean) {
  await db().update(profiles).set({ leaderboardOptIn: optIn }).where(eq(profiles.userId, userId));
  revalidateTag("leaderboard");
}
