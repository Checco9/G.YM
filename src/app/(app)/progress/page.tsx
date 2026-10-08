import type { Metadata } from "next";
import Link from "next/link";
import { BarChart } from "@/components/ui/charts";
import { Card, EmptyState, SectionTitle, Stat } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { LevelBadge } from "@/components/ui/level-badge";
import { requireUser } from "@/modules/auth/session";
import { listWeights } from "@/modules/body/service";
import { getStrengthOverview } from "@/modules/strength/service";
import { loadHistory } from "@/modules/stats/repository";
import { buildOverviewStats, buildWeeklySeries, listAllPRs } from "@/modules/stats/service";
import { fmtDate, fmtDuration, fmtNum, fmtSet, fmtSigned, fmtVolume } from "@/lib/format";
import { levelIndex } from "@/modules/strength/domain/levels";

export const metadata: Metadata = { title: "Progressi" };
export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const user = await requireUser();
  const [history, weights] = await Promise.all([loadHistory(user.id), listWeights(user.id)]);
  const stats = buildOverviewStats(history, weights);
  const weekly = buildWeeklySeries(history, user, 12);
  const prs = listAllPRs(history).slice(0, 6);
  const strength = await getStrengthOverview(user, history);
  const best = strength.exercises
    .filter((e) => e.level !== "unranked")
    .sort((a, b) => levelIndex(b.level) - levelIndex(a.level) || (b.estimatedOneRepMax ?? 0) - (a.estimatedOneRepMax ?? 0))
    .slice(0, 5);

  if (!stats.workouts)
    return (
      <EmptyState
        title="Qui compariranno i tuoi progressi"
        text="Termina il primo allenamento e registra il tuo peso: statistiche, record e livelli di forza si costruiscono da soli."
      />
    );

  return (
    <div className="space-y-2">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="num mb-3 text-2xl font-semibold">Volume settimanale</h2>
          <BarChart data={weekly.map((w) => ({ label: w.label, value: w.volume }))} valueUnit=" kg" />
        </Card>
        <Card>
          <h2 className="num mb-3 text-2xl font-semibold">Allenamenti a settimana</h2>
          <BarChart data={weekly.map((w) => ({ label: w.label, value: w.workouts }))} />
        </Card>
      </div>

      <SectionTitle>Statistiche</SectionTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4"><Stat label="Allenamenti" value={stats.workouts} /></Card>
        <Card className="p-4"><Stat label="Serie totali" value={fmtNum(stats.sets, 0)} /></Card>
        <Card className="p-4"><Stat label="Volume totale" value={fmtNum(Math.round(stats.volume), 0)} unit="kg" /></Card>
        <Card className="p-4"><Stat label="Esercizi registrati" value={stats.exercisesRecorded} /></Card>
        <Card className="p-4 col-span-2">
          <Stat
            label="Esercizio più allenato"
            value={<span className="text-[30px]">{stats.mostTrained?.name ?? "—"}</span>}
            note={stats.mostTrained ? `${stats.mostTrained.sets} serie` : undefined}
          />
        </Card>
        <Card className="p-4 col-span-2">
          <Stat
            label="Miglior PR"
            value={<span className="text-[30px]">{stats.bestPr ? fmtSet(stats.bestPr.weightKg, stats.bestPr.reps) : "—"}</span>}
            note={stats.bestPr?.name}
          />
        </Card>
        <Card className="p-4 col-span-2">
          <Stat
            label="Allenamento più lungo"
            value={<span className="text-[30px]">{stats.longest ? fmtDuration(stats.longest.min) : "—"}</span>}
            note={stats.longest?.name}
          />
        </Card>
        <Card className="p-4 col-span-2">
          <Stat
            label="Peso corporeo"
            value={<span className="text-[30px]">{stats.weight ? `${fmtNum(stats.weight.initial)} → ${fmtNum(stats.weight.current)} kg` : "—"}</span>}
            note={stats.weight ? `${fmtSigned(stats.weight.total)} kg dall'inizio` : "Nessuna misurazione"}
          />
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <SectionTitle action={<Link href="/progress/exercises" className="text-sm font-semibold underline underline-offset-4">Tutti</Link>}>
            Esercizi migliori
          </SectionTitle>
          {best.length ? (
            <Card className="divide-y divide-line p-0">
              {best.map((e) => (
                <Link key={e.exerciseId} href={`/progress/exercises/${e.exerciseId}`} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <div className="truncate text-[17px] font-medium">{e.name}</div>
                    {e.bestSet && <div className="num text-lg text-muted">{fmtSet(e.bestSet.weightKg, e.bestSet.reps)}</div>}
                  </div>
                  <LevelBadge level={e.level} />
                </Link>
              ))}
            </Card>
          ) : (
            <Card className="text-muted">
              I livelli compaiono quando hai registrato il peso corporeo e indicato il sesso nel profilo.
            </Card>
          )}
        </div>
        <div>
          <SectionTitle>Ultimi record</SectionTitle>
          {prs.length ? (
            <Card className="divide-y divide-line p-0">
              {prs.map((p) => (
                <div key={p.workoutId + p.exerciseId} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon name="trophy" size={20} />
                    <div className="min-w-0">
                      <div className="truncate text-[17px] font-medium">{p.exerciseName}</div>
                      <div className="text-sm text-muted">{fmtDate(p.date, user.timezone)}</div>
                    </div>
                  </div>
                  <span className="num shrink-0 text-xl">{fmtSet(p.weightKg, p.reps)}</span>
                </div>
              ))}
            </Card>
          ) : (
            <Card className="text-muted">Il primo record arriva quando superi una tua prestazione precedente.</Card>
          )}
        </div>
      </div>
    </div>
  );
}
