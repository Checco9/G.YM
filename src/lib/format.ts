const nf1 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });

export const fmtNum = (n: number, digits: 0 | 1 | 2 = 1) => (digits === 0 ? nf0 : digits === 1 ? nf1 : nf2).format(n);
export const fmtKg = (n: number) => `${nf2.format(n)} kg`;
export const fmtVolume = (n: number) => `${nf0.format(Math.round(n))} kg`;
export const fmtSigned = (n: number, digits: 0 | 1 | 2 = 1) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmtNum(Math.abs(n), digits)}`;

export function fmtDuration(min: number | null): string {
  if (min === null) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function fmtDate(d: Date | string, tz = "Europe/Rome", opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("it-IT", { timeZone: tz, ...opts }).format(typeof d === "string" ? new Date(d) : d);
}

export function timeAgo(d: Date, now = new Date()): string {
  const min = Math.round((now.getTime() - d.getTime()) / 60000);
  if (min < 1) return "adesso";
  if (min < 60) return `${min} min fa`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ${h === 1 ? "ora" : "ore"} fa`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days} ${days === 1 ? "giorno" : "giorni"} fa`;
  const months = Math.round(days / 30);
  return `${months} ${months === 1 ? "mese" : "mesi"} fa`;
}

/** "45 kg × 8" */
export const fmtSet = (kg: number, reps: number) => `${nf2.format(kg)} kg × ${reps}`;
