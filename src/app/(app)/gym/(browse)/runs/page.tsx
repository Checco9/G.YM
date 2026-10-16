import type { Metadata } from "next";
import Link from "next/link";
import { ManualRunButton } from "@/components/runs-toolbar";
import { StartRunButtons } from "@/components/start-run-button";
import { Card, EmptyState, SectionTitle, Stat } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { LinkButton } from "@/components/ui/button";
import { dayKey, weekStartKey } from "@/lib/dates";
import { fmtDate, fmtKm, fmtNum } from "@/lib/format";
import { requireUser } from "@/modules/auth/session";
import { listWeights } from "@/modules/body/service";
import { fmtClock, fmtPace, paceSecPerKm, runRecords } from "@/modules/runs/domain/run";
import { getActiveRun, listCompletedRuns } from "@/modules/runs/service";
import { runCalories, weightOn } from "@/modules/stats/domain/calories";

export const metadata: Metadata = { title: "Corsa" };
export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const user = await requireUser();
  const [active, runs, weights] = await Promise.all([getActiveRun(user.id), listCompletedRuns(user.id, 200), listWeights(user.id)]);
  const tz = user.timezone;
  const today = dayKey(new Date(), tz);
  const week = weekStartKey(today);
  const km = (list: typeof runs) => list.reduce((n, r) => n + r.distanceM, 0) / 1000;
  const weekRuns = runs.filter((r) => weekStartKey(dayKey(new Date(r.startedAt), tz)) === week);
  const monthRuns = runs.filter((r) => dayKey(new Date(r.startedAt), tz).startsWith(today.slice(0, 7)));
  const rec = runRecords(runs.map((r) => ({ id: r.id, startedAt: new Date(r.startedAt), distanceM: r.distanceM, durationS: r.elapsedS })));

  return (
    <div className="space-y-6">
      {active && (
        <Card className="flex items-center justify-between gap-4 border border-fg/25">
          <div className="min-w-0">
            <div className="text-sm text-muted">Corsa in corso</div>
            <div className="num truncate text-3xl font-semibold">{active.kind === "treadmill" ? "Tapis roulant" : "All'aperto"}</div>
          </div>
          <LinkButton href={`/gym/run/${active.id}`} icon="play">
            Riprendi
          </LinkButton>
        </Card>
      )}

      {!active && <StartRunButtons />}
      <div className="flex justify-end">
        <ManualRunButton today={today} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4"><Stat label="Questa settimana" value={fmtNum(km(weekRuns), 1)} unit="km" note={`${weekRuns.length} ${weekRuns.length === 1 ? "corsa" : "corse"}`} /></Card>
        <Card className="p-4"><Stat label="Questo mese" value={fmtNum(km(monthRuns), 1)} unit="km" note={`${monthRuns.length} ${monthRuns.length === 1 ? "corsa" : "corse"}`} /></Card>
        <Card className="p-4"><Stat label="Più lunga" value={rec.longest ? fmtNum(rec.longest.distanceM / 1000, 1) : "—"} unit={rec.longest ? "km" : undefined} /></Card>
        <Card className="p-4"><Stat label="Miglior passo" value={rec.bestPace ? fmtPace(rec.bestPace.pace) : "—"} unit={rec.bestPace ? "/km" : undefined} note={rec.bestPace ? "Da 3 km in su" : undefined} /></Card>
      </div>

      <SectionTitle>Le tue corse</SectionTitle>
      {runs.length === 0 ? (
        <EmptyState title="Nessuna corsa" text="Avvia il cronometro oppure registra una corsa già fatta: distanza, passo e calorie stimate si calcolano da soli." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {runs.map((r) => {
            const pace = paceSecPerKm(r.distanceM, r.elapsedS);
            const kcal = runCalories({ weightKg: weightOn(weights, dayKey(new Date(r.startedAt), tz)), distanceM: r.distanceM, durationS: r.elapsedS });
            return (
              <Link key={r.id} href={`/gym/runs/${r.id}`}>
                <Card className="flex items-center gap-4 p-4 transition-colors hover:bg-surface2">
                  <div className="w-14 shrink-0 text-center">
                    <div className="num text-4xl font-semibold leading-none">{fmtDate(r.startedAt, tz, { day: "numeric" })}</div>
                    <div className="text-sm text-muted">{fmtDate(r.startedAt, tz, { month: "short" })}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="num text-2xl font-semibold">{fmtKm(r.distanceM)}</div>
                    <div className="text-sm text-muted">
                      {fmtClock(r.elapsedS)}, {fmtPace(pace)} /km{kcal ? `, ${fmtNum(kcal, 0)} kcal` : ""}
                    </div>
                    <div className="text-sm text-muted">{r.kind === "treadmill" ? "Tapis roulant" : "All'aperto"}</div>
                  </div>
                  <Icon name="right" className="text-muted" />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
