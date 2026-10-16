import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { RunStats } from "@/components/run-stats";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { dayKey } from "@/lib/dates";
import { fmtDate, fmtKm } from "@/lib/format";
import { requireUser } from "@/modules/auth/session";
import { listWeights } from "@/modules/body/service";
import { fmtPace, runRecords } from "@/modules/runs/domain/run";
import { getRun, listCompletedRuns } from "@/modules/runs/service";
import { runCalories, weightOn } from "@/modules/stats/domain/calories";

export const metadata: Metadata = { title: "Riepilogo corsa" };
export const dynamic = "force-dynamic";

export default async function RunSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const user = await requireUser();
  const [run, all, weights] = await Promise.all([getRun(user.id, id), listCompletedRuns(user.id, 500), listWeights(user.id)]);
  if (!run || run.status !== "completed") notFound();

  const lite = (r: { id: string; startedAt: string; distanceM: number; elapsedS: number }) => ({ id: r.id, startedAt: new Date(r.startedAt), distanceM: r.distanceM, durationS: r.elapsedS });
  const before = runRecords(all.filter((r) => r.id !== id && r.startedAt <= run.startedAt).map(lite));
  const now = runRecords(all.map(lite));
  const longestPr = before.longest !== null && now.longest?.id === id;
  const pacePr = before.bestPace !== null && now.bestPace?.run.id === id;
  const weightKg = weightOn(weights, dayKey(new Date(run.startedAt), user.timezone));
  const kcal = runCalories({ weightKg, distanceM: run.distanceM, durationS: run.elapsedS });

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-16" style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top))" }}>
      <p className="text-muted">Corsa conclusa</p>
      <h1 className="num text-5xl font-semibold leading-none">{fmtKm(run.distanceM)}</h1>
      <p className="-mt-3 text-muted">{fmtDate(run.startedAt, user.timezone, { weekday: "long", day: "numeric", month: "long" })}</p>
      {(longestPr || pacePr) && (
        <Card className="border border-fg/20">
          <div className="flex items-center gap-2">
            <Icon name="trophy" />
            <h2 className="num text-2xl font-semibold">Nuovo record</h2>
          </div>
          <ul className="mt-2 space-y-1">
            {longestPr && <li>Corsa più lunga: {fmtKm(run.distanceM)}</li>}
            {pacePr && now.bestPace && <li>Miglior passo: {fmtPace(now.bestPace.pace)} /km</li>}
          </ul>
        </Card>
      )}
      <RunStats distanceM={run.distanceM} durationS={run.elapsedS} kcal={kcal} effort={run.effort} weightMissing={weightKg === null} />
      <div className="sticky bottom-4">
        <LinkButton href="/gym/runs" size="lg" className="w-full shadow-lg shadow-black/30">
          Fatto
        </LinkButton>
      </div>
    </div>
  );
}
