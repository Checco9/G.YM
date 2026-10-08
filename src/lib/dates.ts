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
