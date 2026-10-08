import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { LinkButton } from "@/components/ui/button";
import { PrList, WorkoutExercises, WorkoutHeading, WorkoutStats } from "@/components/workout-detail";
import { requireUser } from "@/modules/auth/session";
import { getPostIdForWorkout } from "@/modules/social/service";
import { loadHistory } from "@/modules/stats/repository";
import { buildWorkoutDetail, getWorkoutNotes } from "@/modules/stats/service";
import { listWeights } from "@/modules/body/service";
import { buildRewards, listChallengeRows } from "@/modules/gamification/service";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/progress";

export const metadata: Metadata = { title: "Riepilogo" };
export const dynamic = "force-dynamic";

export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const user = await requireUser();
  const [history, notes, weights, challenges, postId] = await Promise.all([
    loadHistory(user.id),
    getWorkoutNotes(user.id, id),
    listWeights(user.id),
    listChallengeRows(user.id),
    getPostIdForWorkout(user.id, id),
  ]);
  const detail = buildWorkoutDetail(history, id, notes);
  if (!detail) notFound();
  const rewards = buildRewards({ tz: user.timezone, history, weights, challenges }, id);

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-16" style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top))" }}>
      <p className="text-muted">Allenamento concluso</p>
      <WorkoutHeading w={detail} tz={user.timezone} />
      {rewards.xpGained > 0 && (
        <Card>
          <div className="flex items-baseline justify-between">
            <h2 className="num text-2xl font-semibold">{rewards.leveledUp ? `Sei al livello ${rewards.level.level}` : `Livello ${rewards.level.level}, ${rewards.level.title}`}</h2>
            <span className="num text-3xl font-semibold">+{rewards.xpGained} XP</span>
          </div>
          <ProgressBar percent={rewards.level.percent} className="mt-3" />
          <p className="mt-2 text-sm text-muted">
            {rewards.level.xpIntoLevel.toLocaleString("it-IT")} / {rewards.level.xpForNext.toLocaleString("it-IT")} XP al livello {rewards.level.level + 1}
          </p>
          {rewards.newBadges.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-line pt-4">
              {rewards.newBadges.map((b) => (
                <li key={b.id} className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-fg text-onfg"><Icon name="trophy" size={18} /></span>
                  <div>
                    <div className="font-semibold">Nuovo badge: {b.name}</div>
                    <div className="text-sm text-muted">{b.description}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {rewards.xpGained === 0 && (
        <p className="text-sm text-muted">Questo allenamento non dà XP: ne conta uno al giorno e servono almeno 3 serie.</p>
      )}
      <PrList prs={detail.prs} />
      <WorkoutStats w={detail} />
      <WorkoutExercises w={detail} />
      <div className="sticky bottom-4 space-y-2">
        {!postId && (
          <LinkButton href={`/feed/new?workout=${id}`} variant="secondary" size="lg" icon="share" className="w-full shadow-lg shadow-black/30">
            Condividi nel feed
          </LinkButton>
        )}
        <LinkButton href="/home" size="lg" className="w-full shadow-lg shadow-black/30">
          Fatto
        </LinkButton>
      </div>
    </div>
  );
}
