import type { Metadata } from "next";
import Link from "next/link";
import { BarChart } from "@/components/ui/charts";
import { Card, EmptyState, Stat } from "@/components/ui/card";
import { fmtNum } from "@/lib/format";
import { requireUser } from "@/modules/auth/session";
import { getTrends } from "@/modules/diet/service";

export const metadata: Metadata = { title: "Andamento dieta" };
export const dynamic = "force-dynamic";

const RANGES = [7, 14, 30] as const;

export default async function TrendsPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const days = (RANGES as readonly number[]).includes(Number(sp.r)) ? Number(sp.r) : 14;
  const t = await getTrends(user, days);
  const label = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;

  return (
    <div className="space-y-4">
      <h1 className="num text-5xl font-semibold leading-none">Andamento</h1>
      <nav className="flex gap-2" aria-label="Periodo">
        {RANGES.map((r) => (
          <Link key={r} href={`/diet/trends?r=${r}`} className={`h-9 rounded-full px-4 text-sm font-semibold leading-9 ${r === days ? "bg-fg text-onfg" : "bg-surface text-muted"}`}>
            {r} giorni
          </Link>
        ))}
      </nav>

      {t.loggedDays === 0 && t.avgWaterMl === 0 ? (
        <EmptyState title="Ancora nessun dato" text="Registra i pasti e l'acqua per qualche giorno: qui vedrai medie e andamento." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h2 className="num mb-3 text-2xl font-semibold">Calorie al giorno</h2>
              <BarChart data={t.series.map((d) => ({ label: label(d.date), value: d.kcal }))} valueUnit=" kcal" target={t.goals?.kcal} caption="il" />
            </Card>
            <Card>
              <h2 className="num mb-3 text-2xl font-semibold">Acqua al giorno</h2>
              <BarChart data={t.series.map((d) => ({ label: label(d.date), value: d.waterMl }))} valueUnit=" ml" target={t.goals?.waterMl} caption="il" />
            </Card>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card className="p-4"><Stat label="Media calorie" value={fmtNum(t.avg.kcal, 0)} unit="kcal" note={`${t.loggedDays} ${t.loggedDays === 1 ? "giorno registrato" : "giorni registrati"}`} /></Card>
            <Card className="p-4"><Stat label="Media proteine" value={t.avg.protein} unit="g" /></Card>
            <Card className="p-4"><Stat label="Media carboidrati" value={t.avg.carbs} unit="g" /></Card>
            <Card className="p-4"><Stat label="Media grassi" value={t.avg.fat} unit="g" /></Card>
            <Card className="p-4 md:col-span-2">
              <Stat
                label="Giorni in obiettivo"
                value={t.goals ? `${t.onTargetDays} / ${t.loggedDays}` : "—"}
                note={t.goals ? "Calorie entro il 10% dell'obiettivo" : <Link href="/diet/goals" className="underline underline-offset-4">Imposta gli obiettivi</Link>}
              />
            </Card>
            <Card className="p-4 md:col-span-2"><Stat label="Media acqua" value={fmtNum(t.avgWaterMl / 1000, 2)} unit="L" /></Card>
          </div>
        </>
      )}
    </div>
  );
}
