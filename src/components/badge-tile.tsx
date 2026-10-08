import { fmtDate } from "@/lib/format";
import type { BadgeGroup, BadgeState } from "@/modules/gamification/domain/achievements";
import { Icon, type IconName } from "./ui/icons";
import { ProgressBar } from "./ui/progress";

const ICON: Record<BadgeGroup, IconName> = {
  workouts: "gym",
  sets: "list",
  volume: "chart",
  streak: "flame",
  records: "trophy",
  variety: "target",
  body: "scale",
  strength: "body",
};

/** Badge monocromatico: il colore resta riservato ai livelli di forza. */
export function BadgeTile({ b, tz }: { b: BadgeState; tz: string }) {
  return (
    <div
      className={`rounded-[20px] p-4 ${b.unlocked ? "bg-surface" : "border border-dashed border-line"}`}
      aria-label={`${b.name}: ${b.unlocked ? "sbloccato" : `${b.percent}%`}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`flex size-12 items-center justify-center rounded-full ${b.unlocked ? "bg-fg text-onfg" : "bg-surface2 text-muted"}`}
        >
          <Icon name={b.unlocked ? ICON[b.group] : "lock"} size={22} />
        </span>
        {b.xp > 0 && <span className={`num text-lg ${b.unlocked ? "" : "text-muted"}`}>+{b.xp} XP</span>}
      </div>
      <div className={`num mt-3 text-[22px] font-semibold leading-tight ${b.unlocked ? "" : "text-muted"}`}>{b.name}</div>
      <p className="mt-0.5 text-sm text-muted">{b.description}</p>
      {b.unlocked ? (
        <p className="mt-2 text-sm font-semibold">{b.at ? `Sbloccato il ${fmtDate(b.at, tz, { day: "numeric", month: "short", year: "numeric" })}` : "Sbloccato"}</p>
      ) : (
        <div className="mt-3">
          <ProgressBar percent={b.percent} />
          <p className="mt-1 text-xs text-muted">
            {Math.min(b.current, b.target).toLocaleString("it-IT")} / {b.target.toLocaleString("it-IT")}
          </p>
        </div>
      )}
    </div>
  );
}
