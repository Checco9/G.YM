import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { Stat } from "@/components/ui/card";
import { requireUser } from "@/modules/auth/session";
import { loadHistory } from "@/modules/stats/repository";
import { buildCalendar } from "@/modules/stats/service";
import { addDaysToKey } from "@/lib/dates";
import { fmtNum, fmtVolume } from "@/lib/format";

export const metadata: Metadata = { title: "Calendario" };
export const dynamic = "force-dynamic";

const WEEKDAYS = ["L", "M", "M", "G", "V", "S", "D"];

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string; d?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const history = await loadHistory(user.id);
  const today = new Date();
  const m = /^(\d{4})-(\d{2})$/.exec(sp.m ?? "");
  const year = m ? Number(m[1]) : Number(new Intl.DateTimeFormat("en-CA", { timeZone: user.timezone, year: "numeric" }).format(today));
  const month = m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? Number(m[2]) : Number(new Intl.DateTimeFormat("en-CA", { timeZone: user.timezone, month: "numeric" }).format(today));
  const cal = buildCalendar(history, user, year, month);

  const prevKey = addDaysToKey(`${year}-${String(month).padStart(2, "0")}-01`, -1).slice(0, 7);
  const nextKey = addDaysToKey(`${year}-${String(month).padStart(2, "0")}-01`, 32).slice(0, 7);
  const monthLabel = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  const selected = sp.d && cal.byDay[sp.d] ? sp.d : null;

  const cells: (number | null)[] = [...Array(cal.firstWeekday).fill(null), ...Array.from({ length: cal.days }, (_, i) => i + 1)];

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_20rem]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="num text-3xl font-semibold capitalize">{monthLabel}</h2>
          <div className="flex gap-1">
            <Link href={`/gym/calendar?m=${prevKey}`} aria-label="Mese precedente" className="inline-flex size-11 items-center justify-center rounded-full bg-surface">
              <Icon name="left" />
            </Link>
            <Link href={`/gym/calendar?m=${nextKey}`} aria-label="Mese successivo" className="inline-flex size-11 items-center justify-center rounded-full bg-surface">
              <Icon name="right" />
            </Link>
          </div>
        </div>
        <Card className="p-3 md:p-5">
          <div className="grid grid-cols-7 gap-1.5 text-center text-sm text-muted">
            {WEEKDAYS.map((d, i) => (
              <div key={i} className="py-1">{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1.5">
            {cells.map((day, i) => {
              if (day === null) return <div key={i} />;
              const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const trained = cal.byDay[key]?.length ?? 0;
              const isToday = key === cal.todayKey;
              const isSel = key === selected;
              const inner = (
                <span
                  className={`num flex aspect-square w-full items-center justify-center rounded-2xl text-xl font-semibold ${
                    trained ? "bg-fg text-onfg" : "text-fg"
                  } ${isToday && !trained ? "ring-2 ring-fg" : ""} ${isSel ? "outline outline-2 outline-offset-2 outline-fg" : ""}`}
                >
                  {day}
                </span>
              );
              return trained ? (
                <Link key={i} href={`/gym/calendar?m=${year}-${String(month).padStart(2, "0")}&d=${key}`} aria-label={`${day}: ${trained} allenamento`}>
                  {inner}
                </Link>
              ) : (
                <div key={i}>{inner}</div>
              );
            })}
          </div>
        </Card>

        {selected && (
          <div className="mt-4 space-y-2">
            {cal.byDay[selected].map((w) => (
              <Link key={w.id} href={`/gym/history/${w.id}`}>
                <Card className="flex items-center justify-between p-4">
                  <div>
                    <div className="num text-2xl font-semibold">{w.name}</div>
                    <div className="text-sm text-muted">Volume {fmtVolume(w.volume)}</div>
                  </div>
                  <Icon name="right" className="text-muted" />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <aside className="grid grid-cols-2 gap-3 md:grid-cols-1">
        <Card><Stat label="Questo mese" value={cal.monthCount} unit="allenamenti" /></Card>
        <Card><Stat label="Totale" value={cal.totalCount} unit="allenamenti" /></Card>
        <Card>
          <Stat label="Media" value={fmtNum(cal.avgPerWeek)} unit="a settimana" note="Ultime 8 settimane" />
        </Card>
        <Card>
          <Stat
            label="Serie di settimane"
            value={cal.streakWeeks}
            unit={cal.streakWeeks === 1 ? "settimana" : "settimane"}
            note="Settimane di fila con almeno un allenamento"
          />
        </Card>
      </aside>
    </div>
  );
}
