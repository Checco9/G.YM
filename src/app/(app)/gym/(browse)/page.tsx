import type { Metadata } from "next";
import Link from "next/link";
import { PlanCard } from "@/components/plan-card";
import { StartWorkoutButton } from "@/components/start-workout-button";
import { Card, EmptyState } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { requireUser } from "@/modules/auth/session";
import { getActiveWorkout, getPlans } from "@/modules/workouts/service";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Gym" };
export const dynamic = "force-dynamic";

export default async function GymPage() {
  const user = await requireUser();
  const [plans, active] = await Promise.all([getPlans(user.id), getActiveWorkout(user.id)]);

  return (
    <div className="space-y-6">
      {active && (
        <Card className="flex items-center justify-between gap-4 border border-fg/25">
          <div className="min-w-0">
            <div className="text-sm text-muted">Allenamento in corso, iniziato {timeAgo(active.startedAt)}</div>
            <div className="num truncate text-3xl font-semibold">{active.name}</div>
          </div>
          <LinkButton href={`/gym/workout/${active.id}`} icon="play">
            Riprendi
          </LinkButton>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted">Le tue schede</p>
        <div className="flex gap-2">
          {!active && <StartWorkoutButton label="Allenamento libero" variant="secondary" size="sm" icon="plus" />}
          <LinkButton href="/gym/plans/new" size="sm" icon="plus">
            Nuova scheda
          </LinkButton>
        </div>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          title="Nessuna scheda"
          text="Crea la tua prima scheda per avviare gli allenamenti con un tap, oppure parti da un allenamento libero."
          action={<LinkButton href="/gym/plans/new" icon="plus">Crea scheda</LinkButton>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={{ id: p.id, name: p.name, exerciseNames: p.exerciseNames }} />
          ))}
        </div>
      )}
      <p className="text-sm text-muted">
        Storico e calendario sono nelle schede in alto. <Link href="/progress" className="underline underline-offset-4">Vai ai progressi</Link>
      </p>
    </div>
  );
}
