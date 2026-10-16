/** Utilità per le date nel fuso orario dell'utente. Pure e senza dipendenze. */

const fmtCache = new Map<string, Intl.DateTimeFormat>();

function parts(date: Date, tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    fmtCache.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day) };
}

/** "2026-10-05" nel fuso indicato. */
export function dayKey(date: Date, tz: string): string {
  const { y, m, d } = parts(date, tz);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function monthKey(date: Date, tz: string): string {
  return dayKey(date, tz).slice(0, 7);
}

/** Giorno della settimana, 0 = lunedì … 6 = domenica, di una chiave "YYYY-MM-DD". */
export function weekdayOfKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** Chiave del lunedì della settimana che contiene il giorno. */
export function weekStartKey(key: string): string {
  return addDaysToKey(key, -weekdayOfKey(key));
}

export function daysBetweenKeys(a: string, b: string): number {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Differenza (ms) tra l'ora locale del fuso e UTC in un dato istante. */
function tzOffsetMs(at: Date, tz: string): number {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(at.getTime() / 1000) * 1000;
}

/** Converte una data "YYYY-MM-DD" e un'ora "HH:MM" nel fuso dell'utente nell'istante UTC corrispondente. */
export function zonedToUtc(dateKey: string, time: string, tz: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let t = guess - tzOffsetMs(new Date(guess), tz);
  t = guess - tzOffsetMs(new Date(t), tz); // secondo passaggio: ora legale
  return new Date(t);
}

/** Minuti dall'inizio della giornata, giorno ("YYYY-MM-DD") e giorno della settimana (0 = lunedì) nel fuso indicato. */
export function localClock(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", hour: "2-digit", minute: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const key = dayKey(date, tz);
  return { day: key, minutes: Number(p.hour) * 60 + Number(p.minute), weekday: weekdayOfKey(key) };
}
