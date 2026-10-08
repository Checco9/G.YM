import Link from "next/link";
import type { LevelInfo } from "@/modules/gamification/domain/xp";
import { Card } from "./ui/card";
import { Icon } from "./ui/icons";
import { ProgressBar } from "./ui/progress";

export function LevelCard({ level, href = "/progress/achievements", className = "" }: { level: LevelInfo; href?: string; className?: string }) {
  return (
    <Card className={className}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm text-muted">Il tuo livello</div>
          <div className="num flex items-baseline gap-3 leading-none">
            <span className="text-[64px] font-bold">{level.level}</span>
            <span className="text-2xl font-semibold">{level.title}</span>
          </div>
        </div>
        <Link href={href} className="mb-1 inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4">
          Traguardi <Icon name="right" size={14} />
        </Link>
      </div>
      <ProgressBar percent={level.percent} className="mt-4" />
      <p className="mt-2 text-sm text-muted">
        {level.xpIntoLevel.toLocaleString("it-IT")} / {level.xpForNext.toLocaleString("it-IT")} XP al livello {level.level + 1}
      </p>
    </Card>
  );
}
