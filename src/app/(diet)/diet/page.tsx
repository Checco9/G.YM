import type { Metadata } from "next";
import Link from "next/link";
import { DietDay } from "@/components/diet-day";
import { Icon } from "@/components/ui/icons";
import { addDaysToKey, dayKey } from "@/lib/dates";
import { fmtDate } from "@/lib/format";
import { requireUser } from "@/modules/auth/session";
import { getDay, getGoals, listRecents } from "@/modules/diet/service";

export const metadata: Metadata = { title: "Dieta" };
export const dynamic = "force-dynamic";

export default async function DietPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const today = dayKey(new Date(), user.timezone);
  const requested = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : today;
  const date = requested >= addDaysToKey(today, -400) && requested <= addDaysToKey(today, 1) ? requested : today;

  const [day, goals, recents] = await Promise.all([getDay(user.id, date), getGoals(user.id), listRecents(user.id)]);
  const title = date === today ? "Oggi" : date === addDaysToKey(today, -1) ? "Ieri" : date === addDaysToKey(today, 1) ? "Domani" : fmtDate(`${date}T12:00:00Z`, "UTC", { weekday: "long", day: "numeric", month: "long" });
  const prev = addDaysToKey(date, -1);
  const next = addDaysToKey(date, 1);
  const href = (d: string) => (d === today ? "/diet" : `/diet?d=${d}`);

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-muted">{date === today ? fmtDate(`${date}T12:00:00Z`, "UTC", { weekday: "long", day: "numeric", month: "long" }) : "Diario alimentare"}</p>
          <h1 className="num text-5xl font-semibold capitalize leading-none">{title}</h1>
        </div>
        <div className="flex items-center gap-1">
          {date !== today && (
            <Link href="/diet" className="mr-1 inline-flex h-11 items-center rounded-full bg-surface px-4 text-sm font-semibold">
              Oggi
            </Link>
          )}
          <Link href={href(prev)} aria-label="Giorno precedente" className="inline-flex size-11 items-center justify-center rounded-full bg-surface">
            <Icon name="left" />
          </Link>
          {next <= addDaysToKey(today, 1) && (
            <Link href={href(next)} aria-label="Giorno successivo" className="inline-flex size-11 items-center justify-center rounded-full bg-surface">
              <Icon name="right" />
            </Link>
          )}
        </div>
      </div>
      <DietDay key={date} date={date} initialEntries={day.entries} initialWater={day.waterMl} goals={goals} recents={recents} />
    </div>
  );
}
