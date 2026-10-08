import { LEVEL_LABEL, LEVELS, type Level } from "@/modules/strength/domain/levels";

/** Il livello come "dischi": da 0 a 4 barre colorate + etichetta. Il colore è sempre quello del livello. */
export function LevelBadge({ level, compact = false }: { level: Level; compact?: boolean }) {
  const n = LEVELS.indexOf(level);
  return (
    <span className={`lv-${level} inline-flex items-center gap-2 text-sm font-medium`} style={{ color: "var(--lv)" }}>
      <span className="flex items-end gap-[3px]" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="w-[5px] rounded-sm"
            style={{ height: 6 + i * 3, background: "var(--lv)", opacity: i <= n ? 1 : 0.25 }}
          />
        ))}
      </span>
      {!compact && <span>{LEVEL_LABEL[level]}</span>}
    </span>
  );
}
