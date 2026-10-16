import { fmtDuration, fmtKm, fmtNum } from "@/lib/format";
import { fmtClock, fmtPace, paceSecPerKm } from "@/modules/runs/domain/run";
import { EFFORT_LABEL } from "./manual-run-sheet";
import { Card } from "./ui/card";

export function RunStats({ distanceM, durationS, kcal, effort, weightMissing = false }: { distanceM: number; durationS: number; kcal: number | null; effort: number | null; weightMissing?: boolean }) {
  const pace = paceSecPerKm(distanceM, durationS);
  const speed = distanceM >= 100 && durationS > 0 ? distanceM / 1000 / (durationS / 3600) : null;
  const tiles: [string, string][] = [
    ["Distanza", fmtKm(distanceM)],
    ["Durata", durationS >= 3600 ? fmtClock(durationS) : fmtDuration(Math.round(durationS / 60)).replace(" min", " min")],
    ["Passo", `${fmtPace(pace)} /km`],
    ["Velocità", speed ? `${fmtNum(speed, 1)} km/h` : "—"],
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map(([k, v]) => (
          <Card key={k} className="p-4">
            <div className="text-sm text-muted">{k}</div>
            <div className="num mt-0.5 text-[30px] font-semibold leading-none">{v}</div>
          </Card>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4">
          <div className="text-sm text-muted">Calorie stimate</div>
          {kcal !== null ? (
            <>
              <div className="num mt-0.5 text-[30px] font-semibold leading-none">{fmtNum(kcal, 0)} kcal</div>
              <p className="mt-1 text-xs text-muted">Stima teorica da peso, velocità e durata.</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">{weightMissing ? "Registra il tuo peso per vedere la stima delle calorie." : "Non disponibile per questa corsa."}</p>
          )}
        </Card>
        {effort && (
          <Card className="p-4">
            <div className="text-sm text-muted">Sforzo percepito</div>
            <div className="num mt-0.5 text-[30px] font-semibold leading-none">{effort} / 10</div>
            <p className="mt-1 text-xs text-muted">{EFFORT_LABEL[effort]}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
