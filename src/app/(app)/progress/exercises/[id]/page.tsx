import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Card, SectionTitle, Stat } from "@/components/ui/card";
import { LineChart } from "@/components/ui/charts";
import { Icon } from "@/components/ui/icons";
import { LevelBadge } from "@/components/ui/level-badge";
import { requireUser } from "@/modules/auth/session";
import { getStrengthOverview } from "@/modules/strength/service";
import { loadHistory } from "@/modules/stats/repository";
import { buildExerciseProgress } from "@/modules/stats/service";
import { LEVEL_LABEL, LEVELS } from "@/modules/strength/domain/levels";
import { fmtDate, fmtNum, fmtSet } from "@/lib/format";

export const metadata: Metadata = { title: "Progressione esercizio" };
export const dynamic = "force-dynamic";

const REASON: Record<string, string> = {
  no_sex: "Indica il sesso nel profilo per calcolare il livello.",
  no_bodyweight: "Registra il tuo peso corporeo per calcolare il livello.",
  no_standard: "Per questo esercizio non esistono soglie di livello (es. corpo libero o esercizio personale).",
  no_data: "Registra qualche serie per calcolare il livello.",
};

export default async function ExerciseProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const user = await requireUser();
  const history = await loadHistory(user.id);
  const data = buildExerciseProgress(history, id);
  if (!data) notFound();
  const strength = (await getStrengthOverview(user, history)).exercises.find((e) => e.exerciseId === id);
  const tz = user.timezone;
  const points = data.sessions.map((s) => ({
    t: new Date(s.date).getTime(),
    y: s.estimatedOneRepMax ?? s.top.weightKg,
    note: fmtSet(s.top.weightKg, s.top.reps),
  }));
  const hasE1rm = data.sessions.some((s) => s.estimatedOneRepMax !== null);
  const bestWeight = Math.max(...data.sessions.map((s) => s.top.weightKg));
  const totalVolume = data.sessions.reduce((n, s) => n + s.volume, 0);

  return (
    <div className="space-y-5">
      <Link href="/progress/exercises" className="inline-flex items-center gap-1 text-muted hover:text-fg">
        <Icon name="left" size={18} /> Esercizi
      </Link>
      <h2 className="num text-5xl font-semibold leading-none">{data.name}</h2>

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Card>
          <h3 className="num mb-2 text-2xl font-semibold">{hasE1rm ? "1RM stimato nel tempo" : "Carico nel tempo"}</h3>
          <LineChart
            points={points}
            unit="kg"
            tz={tz}
          />
          {hasE1rm && <p className="mt-2 text-sm text-muted">Stima con la formula di Epley sulla serie migliore di ogni sessione.</p>}
        </Card>
        <Card className="space-y-5">
          <Stat label="Carico massimo" value={fmtNum(bestWeight, 2)} unit="kg" />
          <Stat label="Volume totale" value={fmtNum(Math.round(totalVolume), 0)} unit="kg" />
          <div>
            <div className="text-sm text-muted">Livello</div>
            <div className="mt-1"><LevelBadge level={strength?.level ?? "unranked"} /></div>
            {strength?.level === "unranked" && strength.reason && <p className="mt-1.5 text-sm text-muted">{REASON[strength.reason]}</p>}
            {strength?.thresholds && (
              <p className="mt-2 text-sm text-muted">
                {LEVELS.slice(2).map((l) => `${LEVEL_LABEL[l]}: ${fmtNum(strength.thresholds![l as "intermediate" | "advanced" | "elite"], 2)}× il peso corporeo`).join(". ")}.
              </p>
            )}
          </div>
        </Card>
      </div>

      {data.prs.length > 0 && (
        <>
          <SectionTitle>Record</SectionTitle>
          <Card className="divide-y divide-line p-0">
            {[...data.prs].reverse().map((p) => (
              <div key={p.workoutId} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <Icon name="trophy" size={20} />
                  <span className="text-muted">{fmtDate(p.date, tz, { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                <span className="num text-xl">{fmtSet(p.weightKg, p.reps)}</span>
              </div>
            ))}
          </Card>
        </>
      )}

      <SectionTitle>Sessioni</SectionTitle>
      <div className="space-y-2">
        {[...data.sessions].reverse().map((s) => (
          <Link key={s.workoutId} href={`/gym/history/${s.workoutId}`}>
            <Card className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="text-sm text-muted">{fmtDate(s.date, tz, { weekday: "short", day: "numeric", month: "short" })}</div>
                <div className="num text-xl">{s.sets.map((x) => `${fmtNum(x.weightKg, 2)}×${x.reps}`).join("  ")}</div>
              </div>
              <Icon name="right" className="text-muted" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
