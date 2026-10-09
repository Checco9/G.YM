import type { Metadata } from "next";
import Link from "next/link";
import { GoalCard } from "@/components/goal-manager";
import { StartWorkoutButton } from "@/components/start-workout-button";
import { Card, Stat } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { requireUser } from "@/modules/auth/session";
import { listWeights } from "@/modules/body/service";
import { listGoals } from "@/modules/goals/service";
import { LevelCard } from "@/components/level-card";
import { ModeLink } from "@/components/mode-link";
import { Avatar } from "@/components/post-card";
import { ProgressBar } from "@/components/ui/progress";
import { getTodaySummary } from "@/modules/diet/service";
import { dayKey } from "@/lib/dates";
import { buildGamification, listChallengeRows } from "@/modules/gamification/service";
import { loadHistory } from "@/modules/stats/repository";
import { buildDashboard } from "@/modules/stats/service";
import { getActiveWorkout } from "@/modules/workouts/service";
import { fmtNum, fmtSet, fmtSigned, fmtVolume, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Home" };
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  // tutte le letture partono insieme
  const [history, weights, active, challengeRows, diet] = await Promise.all([
    loadHistory(user.id),
    listWeights(user.id),
    getActiveWorkout(user.id),
    listChallengeRows(user.id),
    getTodaySummary(user.id, dayKey(new Date(), user.timezone)),
  ]);
  const [goalsAll] = await Promise.all([listGoals(user.id, history, user.timezone, weights)]);
  const d = buildDashboard(history, user, weights);
  const game = buildGamification({ tz: user.timezone, history, weights, challenges: challengeRows });
  const goals = goalsAll.filter((g) => !g.achieved);
  const goal = goals[0] ?? null;

  const segments = Math.max(d.weeklyTarget, d.weekCount);

  return (
    <div className="space-y-4">
      <header className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-muted">Oggi</p>
          <h1 className="num text-[44px] font-semibold leading-[1.02] md:text-6xl">
            Buon allenamento,
            <br />
            {user.displayName}
          </h1>
        </div>
        <Link href="/profile" aria-label="Il tuo profilo" className="md:hidden">
          <Avatar name={user.displayName} />
        </Link>
      </header>

      {active ? (
        <Card className="flex items-center justify-between gap-4 border border-fg/25">
          <div className="min-w-0">
            <div className="text-sm text-muted">Allenamento in corso</div>
            <div className="num truncate text-3xl font-semibold">{active.name}</div>
          </div>
          <LinkButton href={`/gym/workout/${active.id}`} icon="play">Riprendi</LinkButton>
        </Card>
      ) : (
        <StartWorkoutButton label="Inizia un allenamento" size="lg" className="w-full md:w-auto" />
      )}

      <div className="grid gap-4 md:grid-cols-6">
        <LevelCard level={game.level} className="md:col-span-6" />

        <Card className="md:col-span-3">
          <Stat label="Allenamenti questa settimana" value={<>{d.weekCount}<span className="text-muted"> / {d.weeklyTarget}</span></>} />
          <div className="mt-4 flex gap-1.5" aria-hidden="true">
            {Array.from({ length: segments }, (_, i) => (
              <span key={i} className={`h-2.5 flex-1 rounded-full ${i < d.weekCount ? "bg-fg" : "bg-surface2"}`} />
            ))}
          </div>
          <p className="mt-3 text-sm text-muted">
            {d.streakWeeks > 0 ? `${d.streakWeeks} ${d.streakWeeks === 1 ? "settimana" : "settimane"} di fila` : "Inizia la tua serie questa settimana"}
          </p>
        </Card>

        <Card className="md:col-span-3">
          <Stat label="Questo mese" value={d.monthCount} unit={d.monthCount === 1 ? "allenamento" : "allenamenti"} />
          <Link href="/gym/calendar" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4">
            Apri il calendario <Icon name="right" size={14} />
          </Link>
        </Card>

        <Card className="md:col-span-2">
          <Stat
            label="Peso attuale"
            value={d.weight ? fmtNum(d.weight.current) : "—"}
            unit={d.weight ? "kg" : undefined}
            note={
              d.weight ? (
                d.weight.recent !== null ? `${d.weight.recent < 0 ? "↓" : d.weight.recent > 0 ? "↑" : "="} ${fmtNum(Math.abs(d.weight.recent))} kg questa settimana` : "Una sola misurazione"
              ) : (
                <Link href="/progress/weight" className="underline underline-offset-4">Registra il peso</Link>
              )
            }
          />
        </Card>

        <Card className="md:col-span-2">
          <Stat
            label="Ultimo workout"
            value={<span className="text-[32px]">{d.last?.name ?? "—"}</span>}
            note={d.last ? `${timeAgo(new Date(d.last.endedAt))}, volume ${fmtVolume(d.last.volume)}` : "Ancora nessuno"}
          />
          {d.last && (
            <Link href={`/gym/history/${d.last.id}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4">
              Dettagli <Icon name="right" size={14} />
            </Link>
          )}
        </Card>

        <Card className="md:col-span-2">
          <Stat
            label="Record recente"
            value={<span className="text-[30px]">{d.lastPr ? fmtSet(d.lastPr.weightKg, d.lastPr.reps) : "—"}</span>}
            note={d.lastPr ? d.lastPr.exerciseName : "Il primo arriva quando superi un tuo risultato"}
          />
        </Card>

        <Card className="md:col-span-3">
          <Stat
            label="Miglioramento recente"
            value={d.volumeChange === null ? "—" : `${fmtSigned(d.volumeChange, 0)}%`}
            note={d.volumeChange === null ? "Servono due settimane di dati" : `Volume degli ultimi 7 giorni: ${fmtVolume(d.volumeLast7)}`}
          />
        </Card>

        <div className="md:col-span-3">
          {goal ? (
            <GoalCard g={goal} tz={user.timezone} />
          ) : (
            <Card className="flex h-full flex-col justify-between">
              <Stat label="Obiettivo principale" value={<span className="text-[30px]">Nessuno</span>} />
              <Link href="/progress/goals" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4">
                Crea un obiettivo <Icon name="right" size={14} />
              </Link>
            </Card>
          )}
        </div>

        <ModeLink href="/diet" mode="diet" className="md:col-span-6">
          <Card className="flex items-center gap-4 transition-colors hover:bg-surface2">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface2">
              <Icon name="fork" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="num text-2xl font-semibold">Dieta</div>
              <div className="text-sm text-muted">
                {diet ? `${fmtNum(diet.consumed, 0)} di ${fmtNum(diet.goal, 0)} kcal oggi` : "Registra pasti e acqua, imposta i tuoi obiettivi"}
              </div>
              {diet && <ProgressBar percent={Math.min(100, Math.round((diet.consumed / diet.goal) * 100))} className="mt-2" />}
            </div>
            <Icon name="right" className="shrink-0 text-muted" />
          </Card>
        </ModeLink>
      </div>
    </div>
  );
}
