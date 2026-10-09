import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { requireUser } from "@/modules/auth/session";
import { loadHistory } from "@/modules/stats/repository";
import { buildWorkoutList } from "@/modules/stats/service";
import { fmtDate, fmtDuration, fmtVolume } from "@/lib/format";

export const metadata: Metadata = { title: "Storico" };
export const dynamic = "force-dynamic";

const PAGE = 30;

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const sp = await searchParams;
  const pages = Math.min(50, Math.max(1, parseInt(sp.p ?? "1", 10) || 1));
  const user = await requireUser();
  const all = buildWorkoutList(await loadHistory(user.id));
  const list = all.slice(0, pages * PAGE);
  if (!all.length)
    return <EmptyState title="Ancora nessun allenamento" text="Quando termini un allenamento lo trovi qui, con tutti i dettagli." />;

  const groups = new Map<string, typeof list>();
  for (const w of list) {
    const key = fmtDate(w.startedAt, user.timezone, { month: "long", year: "numeric" });
    groups.set(key, [...(groups.get(key) ?? []), w]);
  }

  return (
    <div className="space-y-8">
      {[...groups.entries()].map(([month, items]) => (
        <section key={month}>
          <h2 className="num mb-3 text-2xl font-semibold capitalize">{month}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((w) => (
              <Link key={w.id} href={`/gym/history/${w.id}`}>
                <Card className="flex items-center gap-4 p-4 transition-colors hover:bg-surface2">
                  <div className="w-14 shrink-0 text-center">
                    <div className="num text-4xl font-semibold leading-none">
                      {fmtDate(w.startedAt, user.timezone, { day: "numeric" })}
                    </div>
                    <div className="text-sm text-muted">{fmtDate(w.startedAt, user.timezone, { month: "short" })}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="num truncate text-2xl font-semibold">{w.name}</span>
                      {w.prCount > 0 && <Icon name="trophy" size={18} aria-label="Con record personali" />}
                    </div>
                    <div className="text-sm text-muted">
                      {fmtDuration(w.durationMin)}, {w.exerciseCount} esercizi, {w.setCount} serie
                    </div>
                    <div className="text-sm text-muted">Volume {fmtVolume(w.volume)}</div>
                  </div>
                  <Icon name="right" className="text-muted" />
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
      {all.length > list.length && (
        <div className="flex justify-center pt-2">
          <Link href={`/gym/history?p=${pages + 1}`} className="inline-flex h-12 items-center rounded-2xl bg-surface2 px-6 font-semibold">
            Mostra altri ({all.length - list.length})
          </Link>
        </div>
      )}
    </div>
  );
}
