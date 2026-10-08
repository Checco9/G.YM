import type { Metadata } from "next";
import { BadgeTile } from "@/components/badge-tile";
import { LevelCard } from "@/components/level-card";
import { Card, SectionTitle, Stat } from "@/components/ui/card";
import { requireUser } from "@/modules/auth/session";
import { listWeights } from "@/modules/body/service";
import { BADGE_GROUP_LABEL, type BadgeGroup } from "@/modules/gamification/domain/achievements";
import { XP_RULES } from "@/modules/gamification/domain/xp";
import { getGamification } from "@/modules/gamification/service";
import { loadHistory } from "@/modules/stats/repository";
import { getStrengthOverview } from "@/modules/strength/service";

export const metadata: Metadata = { title: "Traguardi" };
export const dynamic = "force-dynamic";

export default async function AchievementsPage() {
  const user = await requireUser();
  const [history, weights] = await Promise.all([loadHistory(user.id), listWeights(user.id)]);
  const strength = await getStrengthOverview(user, history);
  const g = await getGamification(user.id, user.timezone, history, weights, strength);

  const groups = new Map<BadgeGroup, typeof g.badges>();
  for (const b of g.badges) groups.set(b.group, [...(groups.get(b.group) ?? []), b]);
  const unlocked = g.badges.filter((b) => b.unlocked).length;

  const rows: [string, number][] = [
    ["Allenamenti", g.xp.workouts],
    ["Serie completate", g.xp.sets],
    ["Record personali", g.xp.records],
    ["Settimane piene", g.xp.weeks],
    ["Badge", g.xp.badges],
    ["Sfide completate", g.xp.challenges],
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <LevelCard level={g.level} href="/progress/achievements" />
        <Card className="grid grid-cols-2 gap-4">
          <Stat label="Serie attuale" value={g.streak.current} unit={g.streak.current === 1 ? "settimana" : "settimane"} />
          <Stat label="Record" value={g.streak.best} unit={g.streak.best === 1 ? "settimana" : "settimane"} />
        </Card>
      </div>

      <Card>
        <div className="flex items-baseline justify-between">
          <h2 className="num text-2xl font-semibold">Da dove arriva l'XP</h2>
          <span className="num text-2xl">{g.xp.total.toLocaleString("it-IT")} XP</span>
        </div>
        <dl className="mt-3 divide-y divide-line">
          {rows.map(([label, v]) => (
            <div key={label} className="flex justify-between py-2">
              <dt className="text-muted">{label}</dt>
              <dd className="num text-xl">{v.toLocaleString("it-IT")}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-muted">
          {XP_RULES.perWorkout} XP per allenamento (serve almeno {XP_RULES.minSetsForWorkout} serie, uno al giorno), {XP_RULES.perSet} per serie fino a {XP_RULES.maxSetsPerWorkout} per
          allenamento, {XP_RULES.perPr} per record, {XP_RULES.perFullWeek} per ogni settimana con almeno {XP_RULES.fullWeekMinWorkouts} allenamenti, {XP_RULES.perChallenge} per sfida completata.
        </p>
      </Card>

      <SectionTitle>
        Badge, {unlocked} su {g.badges.length}
      </SectionTitle>
      <div className="space-y-8">
        {[...groups.entries()].map(([group, items]) => (
          <section key={group}>
            <h3 className="num mb-3 text-xl font-semibold text-muted">{BADGE_GROUP_LABEL[group]}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...items].sort((a, b) => a.tier - b.tier).map((b) => (
                <BadgeTile key={b.id} b={b} tz={user.timezone} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
