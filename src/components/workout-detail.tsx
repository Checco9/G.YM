import { fmtDate, fmtDuration, fmtNum, fmtSet, fmtVolume } from "@/lib/format";
import type { WorkoutDetail } from "@/modules/stats/service";
import { Card } from "./ui/card";
import { Icon } from "./ui/icons";

export function WorkoutStats({ w }: { w: WorkoutDetail }) {
  const items = [
    { label: "Durata", value: fmtDuration(w.durationMin) },
    { label: "Esercizi", value: String(w.exerciseCount) },
    { label: "Serie", value: String(w.setCount) },
    { label: "Volume totale", value: fmtVolume(w.volume) },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((i) => (
        <Card key={i.label} className="p-4">
          <div className="text-sm text-muted">{i.label}</div>
          <div className="num mt-0.5 text-[32px] font-semibold leading-none">{i.value}</div>
        </Card>
      ))}
    </div>
  );
}

export function PrBadge({ kinds }: { kinds: string[] }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-fg px-2.5 py-1 text-xs font-bold text-onfg">
      <Icon name="trophy" size={14} />
      {kinds.includes("estimated_1rm") ? "Nuovo PR" : "PR di carico"}
    </span>
  );
}

export function WorkoutExercises({ w }: { w: WorkoutDetail }) {
  return (
    <div className="space-y-3">
      {w.exercises.map((e) => (
        <Card key={e.exerciseId + e.name + e.volume}>
          <div className="flex items-start justify-between gap-3">
            <h3 className="num text-[24px] font-semibold leading-tight">{e.name}</h3>
            {e.pr && <PrBadge kinds={e.pr.kinds} />}
          </div>
          <ol className="mt-3 space-y-1.5">
            {e.sets.map((s, i) => (
              <li key={i} className="flex items-baseline gap-3">
                <span className="num w-6 text-lg text-muted">{i + 1}</span>
                <span className="num text-xl">{fmtSet(s.weightKg, s.reps)}</span>
              </li>
            ))}
          </ol>
          <div className="mt-3 text-sm text-muted">Volume: {fmtVolume(e.volume)}</div>
        </Card>
      ))}
    </div>
  );
}

export function WorkoutHeading({ w, tz }: { w: WorkoutDetail; tz: string }) {
  return (
    <div>
      <h1 className="num text-5xl font-semibold leading-none">{w.name}</h1>
      <p className="mt-2 text-muted">
        {fmtDate(w.startedAt, tz, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </p>
    </div>
  );
}

export function PrList({ prs }: { prs: WorkoutDetail["prs"] }) {
  if (!prs.length) return null;
  return (
    <Card className="border border-fg/20">
      <div className="flex items-center gap-2">
        <Icon name="trophy" />
        <h2 className="num text-2xl font-semibold">
          {prs.length === 1 ? "Nuovo record personale" : `${prs.length} nuovi record personali`}
        </h2>
      </div>
      <ul className="mt-3 space-y-2">
        {prs.map((p) => (
          <li key={p.exerciseName} className="flex items-baseline justify-between gap-3">
            <span className="text-[17px] font-medium">{p.exerciseName}</span>
            <span className="num text-xl">{fmtSet(p.weightKg, p.reps)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export { fmtNum };
