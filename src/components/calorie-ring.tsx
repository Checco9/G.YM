import { fmtNum } from "@/lib/format";

/** Anello delle calorie: quante ne restano oggi. Diventa rosso solo quando si supera l'obiettivo. */
export function CalorieRing({ consumed, goal, percent, over }: { consumed: number; goal: number; percent: number; over: boolean }) {
  const r = 78;
  const c = 2 * Math.PI * r;
  const remaining = Math.round(goal - consumed);
  return (
    <div className="relative mx-auto size-[200px]" role="img" aria-label={over ? `Obiettivo superato di ${-remaining} kcal` : `${remaining} kcal rimaste su ${goal}`}>
      <svg viewBox="0 0 200 200" className="size-full -rotate-90">
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="16" />
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke={over ? "var(--danger)" : "var(--fg)"}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${(c * percent) / 100} ${c}`}
          style={{ transition: "stroke-dasharray .5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className={`num text-[52px] font-bold leading-none ${over ? "text-danger" : ""}`}>{fmtNum(Math.abs(remaining), 0)}</div>
        <div className="mt-1 text-sm text-muted">{over ? "kcal oltre" : "kcal rimaste"}</div>
      </div>
    </div>
  );
}
