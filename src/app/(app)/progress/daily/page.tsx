import type { Metadata } from "next";
import Link from "next/link";
import { DailyForm, DailyGoalsButton } from "@/components/daily-form";
import { BarChart } from "@/components/ui/charts";
import { Card, EmptyState, Stat } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { addDaysToKey, dayKey } from "@/lib/dates";
import { fmtNum, fmtSleep } from "@/lib/format";
import { requireUser } from "@/modules/auth/session";
import { getDaily, getDailyRange } from "@/modules/daily/service";

export const metadata: Metadata = { title: "Sonno e passi" };
export const dynamic = "force-dynamic";

const RANGES = [7, 14, 30] as const;

export default async function DailyPage({ searchParams }: { searchParams: Promise<{ d?: string; r?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const today = dayKey(new Date(), user.timezone);
  const req = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : today;
  const date = req <= today && req >= addDaysToKey(today, -400) ? req : today;
  const days = (RANGES as readonly number[]).includes(Number(sp.r)) ? Number(sp.r) : 14;
  const [log, series] = await Promise.all([getDaily(user.id, date), getDailyRange(user, days)]);

  const steps = series.filter((d) => d.steps !== null);
  const sleep = series.filter((d) => d.sleepMinutes !== null);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const avgSteps = avg(steps.map((d) => d.steps!));
  const avgSleep = avg(sleep.map((d) => d.sleepMinutes!));
  const stepDays = steps.filter((d) => d.steps! >= user.stepsGoal).length;
  const sleepDays = sleep.filter((d) => d.sleepMinutes! >= user.sleepGoalMin).length;
  const label = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;
  const title = date === today ? "Oggi" : date === addDaysToKey(today, -1) ? "Ieri" : label(date);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link href={`/progress/daily?d=${addDaysToKey(date, -1)}&r=${days}`} aria-label="Giorno precedente" className="inline-flex size-11 items-center justify-center rounded-full bg-surface">
            <Icon name="left" />
          </Link>
          <h2 className="num px-2 text-3xl font-semibold">{title}</h2>
          {date < today && (
            <Link href={`/progress/daily?d=${addDaysToKey(date, 1)}&r=${days}`} aria-label="Giorno successivo" className="inline-flex size-11 items-center justify-center rounded-full bg-surface">
              <Icon name="right" />
            </Link>
          )}
        </div>
        <DailyGoalsButton stepsGoal={user.stepsGoal} sleepGoalMin={user.sleepGoalMin} />
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] md:items-start">
        <DailyForm key={date} log={log} />
        <div className="space-y-4">
          <nav className="flex gap-2" aria-label="Periodo">
            {RANGES.map((r) => (
              <Link key={r} href={`/progress/daily?d=${date}&r=${r}`} className={`h-9 rounded-full px-4 text-sm font-semibold leading-9 ${r === days ? "bg-fg text-onfg" : "bg-surface text-muted"}`}>
                {r} giorni
              </Link>
            ))}
          </nav>
          {steps.length === 0 && sleep.length === 0 ? (
            <EmptyState title="Ancora nessun dato" text="Inserisci i passi e il sonno di oggi: qui vedrai l'andamento e le medie." />
          ) : (
            <>
              <Card>
                <h2 className="num mb-3 text-2xl font-semibold">Passi</h2>
                <BarChart data={series.map((d) => ({ label: label(d.date), value: d.steps ?? 0 }))} valueUnit=" passi" target={user.stepsGoal} caption="il" />
              </Card>
              <Card>
                <h2 className="num mb-3 text-2xl font-semibold">Sonno</h2>
                <BarChart data={series.map((d) => ({ label: label(d.date), value: (d.sleepMinutes ?? 0) / 60 }))} valueUnit=" h" target={user.sleepGoalMin / 60} caption="il" decimals={1} />
              </Card>
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4"><Stat label="Media passi" value={avgSteps !== null ? fmtNum(avgSteps, 0) : "—"} note={`${stepDays} giorni oltre ${fmtNum(user.stepsGoal, 0)}`} /></Card>
                <Card className="p-4"><Stat label="Media sonno" value={<span className="text-[34px]">{fmtSleep(avgSleep)}</span>} note={`${sleepDays} giorni oltre ${fmtSleep(user.sleepGoalMin)}`} /></Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
