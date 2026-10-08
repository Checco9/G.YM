import type { Metadata } from "next";
import { ChallengeManager } from "@/components/challenge-manager";
import { GoalManager } from "@/components/goal-manager";
import { SectionTitle } from "@/components/ui/card";
import { requireUser } from "@/modules/auth/session";
import { getExercises } from "@/modules/exercises/service";
import { listChallengeRows, buildGamification } from "@/modules/gamification/service";
import { listGoals } from "@/modules/goals/service";
import { listWeights } from "@/modules/body/service";
import { loadHistory } from "@/modules/stats/repository";

export const metadata: Metadata = { title: "Obiettivi" };
export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const user = await requireUser();
  const [history, weights, challengeRows, exercises] = await Promise.all([
    loadHistory(user.id),
    listWeights(user.id),
    listChallengeRows(user.id),
    getExercises(user.id),
  ]);
  const goals = await listGoals(user.id, history, user.timezone, weights);
  const g = buildGamification({ tz: user.timezone, history, weights, challenges: challengeRows });
  return (
    <div className="space-y-2">
      <GoalManager
        goals={goals}
        exercises={exercises.filter((e) => e.category !== "bodyweight").map((e) => ({ id: e.id, name: e.name }))}
        tz={user.timezone}
      />
      <SectionTitle>Sfide</SectionTitle>
      <ChallengeManager items={g.challenges} tz={user.timezone} />
    </div>
  );
}
