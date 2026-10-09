import type { Metadata } from "next";
import Link from "next/link";
import { LeaderboardOptIn } from "@/components/leaderboard-optin";
import { Card, EmptyState } from "@/components/ui/card";
import { requireUser } from "@/modules/auth/session";
import { CATEGORIES, PERIOD_LABEL, type Category, type Period } from "@/modules/gamification/domain/leaderboard";
import { getLeaderboard, type LeaderboardMember } from "@/modules/gamification/service";
import { fmtNum } from "@/lib/format";

export const metadata: Metadata = { title: "Classifica" };
export const dynamic = "force-dynamic";

type M = LeaderboardMember;
const VALUE: Record<Category, { value: (m: M, p: Period) => number; fmt: (n: number) => string }> = {
  xp: { value: (m) => m.xp, fmt: (n) => `${fmtNum(n, 0)} XP` },
  workouts: { value: (m, p) => m.periods[p].workouts, fmt: (n) => `${n}` },
  volume: { value: (m, p) => m.periods[p].volume, fmt: (n) => `${fmtNum(n / 1000, n >= 100000 ? 0 : 1)} t` },
  time: { value: (m, p) => m.periods[p].minutes, fmt: (n) => `${fmtNum(n / 60, 1)} h` },
  records: { value: (m, p) => m.periods[p].records, fmt: (n) => `${n}` },
  variety: { value: (m, p) => m.periods[p].variety, fmt: (n) => `${n}` },
  streak: { value: (m) => m.streak, fmt: (n) => `${n} sett.` },
  social: { value: (m, p) => m.periods[p].social, fmt: (n) => `${n}` },
};

const chip = (active: boolean) => `h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold leading-9 ${active ? "bg-fg text-onfg" : "bg-surface text-muted"}`;

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ c?: string; p?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const cat = CATEGORIES.find((c) => c.key === sp.c) ?? CATEGORIES[0];
  const period: Period = sp.p === "week" || sp.p === "all" ? sp.p : "month";

  if (!user.leaderboardOptIn) {
    return (
      <EmptyState
        title="La classifica è facoltativa"
        text="Se partecipi, gli altri iscritti vedono il tuo nome, il livello e i tuoi numeri di allenamento, e tu vedi i loro. Puoi uscire quando vuoi."
        action={<LeaderboardOptIn optIn={false} />}
      />
    );
  }

  const v = VALUE[cat.key];
  const rows = [...(await getLeaderboard())].sort((a, b) => v.value(b, period) - v.value(a, period) || b.xp - a.xp);
  const href = (c: string, p: string) => `/progress/leaderboard?c=${c}&p=${p}`;

  return (
    <div className="space-y-4">
      <nav className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label="Categoria">
        {CATEGORIES.map((c) => (
          <Link key={c.key} href={href(c.key, period)} className={chip(c.key === cat.key)}>
            {c.label}
          </Link>
        ))}
      </nav>
      {cat.periodic && (
        <nav className="flex gap-2" aria-label="Periodo">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <Link key={p} href={href(cat.key, p)} className={chip(p === period)}>
              {PERIOD_LABEL[p]}
            </Link>
          ))}
        </nav>
      )}
      <p className="text-sm text-muted">{cat.hint}{cat.periodic ? `, ${period === "all" ? "in totale" : `ultimi ${PERIOD_LABEL[period]}`}` : ""}.</p>

      <Card className="divide-y divide-line p-0">
        {rows.map((r, i) => (
          <div key={r.userId} className={`flex items-center gap-4 px-5 py-3.5 ${r.userId === user.id ? "bg-surface2" : ""}`}>
            <span className={`num w-8 text-3xl font-semibold ${i === 0 ? "" : "text-muted"}`}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[17px] font-semibold">
                {r.name}
                {r.userId === user.id && <span className="ml-2 text-sm font-normal text-muted">tu</span>}
              </div>
              <div className="text-sm text-muted">Livello {r.level}</div>
            </div>
            <span className="num text-2xl font-semibold">{v.fmt(v.value(r, period))}</span>
          </div>
        ))}
      </Card>
      {rows.length === 1 && <p className="text-sm text-muted">Sei l'unico partecipante: gli altri compariranno quando attiveranno la classifica.</p>}
      <LeaderboardOptIn optIn />
    </div>
  );
}
