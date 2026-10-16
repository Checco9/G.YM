import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DeleteRunButton } from "@/components/delete-run-button";
import { RunStats } from "@/components/run-stats";
import { Icon } from "@/components/ui/icons";
import { dayKey } from "@/lib/dates";
import { fmtDate } from "@/lib/format";
import { requireUser } from "@/modules/auth/session";
import { listWeights } from "@/modules/body/service";
import { getRun } from "@/modules/runs/service";
import { runCalories, weightOn } from "@/modules/stats/domain/calories";

export const metadata: Metadata = { title: "Dettaglio corsa" };
export const dynamic = "force-dynamic";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const user = await requireUser();
  const [run, weights] = await Promise.all([getRun(user.id, id), listWeights(user.id)]);
  if (!run || run.status !== "completed") notFound();
  const weightKg = weightOn(weights, dayKey(new Date(run.startedAt), user.timezone));
  const kcal = runCalories({ weightKg, distanceM: run.distanceM, durationS: run.elapsedS });

  return (
    <div className="space-y-5">
      <Link href="/gym/runs" className="inline-flex items-center gap-1 text-muted hover:text-fg">
        <Icon name="left" size={18} /> Corsa
      </Link>
      <div>
        <h1 className="num text-5xl font-semibold leading-none">{run.kind === "treadmill" ? "Tapis roulant" : "Corsa all'aperto"}</h1>
        <p className="mt-2 text-muted">{fmtDate(run.startedAt, user.timezone, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      </div>
      <RunStats distanceM={run.distanceM} durationS={run.elapsedS} kcal={kcal} effort={run.effort} weightMissing={weightKg === null} />
      {run.notes && <p className="rounded-[22px] bg-surface p-5 whitespace-pre-wrap">{run.notes}</p>}
      <DeleteRunButton id={run.id} />
    </div>
  );
}
