import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { LevelBadge } from "@/components/ui/level-badge";
import { requireUser } from "@/modules/auth/session";
import { getStrengthOverview } from "@/modules/strength/service";
import { loadHistory } from "@/modules/stats/repository";
import { listTrainedExercises } from "@/modules/stats/service";
import { fmtDate, fmtSet } from "@/lib/format";

export const metadata: Metadata = { title: "Esercizi" };
export const dynamic = "force-dynamic";

export default async function ExercisesProgressPage() {
  const user = await requireUser();
  const history = await loadHistory(user.id);
  const list = listTrainedExercises(history);
  if (!list.length) return <EmptyState title="Nessun esercizio registrato" text="Dopo il primo allenamento potrai seguire la progressione di ogni esercizio." />;
  const strength = await getStrengthOverview(user, history);
  const byId = new Map(strength.exercises.map((e) => [e.exerciseId, e]));

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {list.map((e) => {
        const s = byId.get(e.exerciseId);
        return (
          <Link key={e.exerciseId} href={`/progress/exercises/${e.exerciseId}`}>
            <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-surface2">
              <div className="min-w-0 flex-1">
                <div className="num truncate text-2xl font-semibold">{e.name}</div>
                <div className="text-sm text-muted">
                  {e.sessions} {e.sessions === 1 ? "sessione" : "sessioni"}, ultima {fmtDate(e.lastAt, user.timezone)}
                </div>
                {s?.bestSet && <div className="num text-lg">{fmtSet(s.bestSet.weightKg, s.bestSet.reps)}</div>}
              </div>
              <LevelBadge level={s?.level ?? "unranked"} compact />
              <Icon name="right" className="text-muted" />
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
