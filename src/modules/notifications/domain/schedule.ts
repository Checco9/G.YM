import { localClock } from "@/lib/dates";

export const DAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"] as const;
export const ALL_DAYS = 127;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const isValidTime = (t: string) => TIME_RE.test(t);
export const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export const fromMinutes = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

/** Maschera di bit: lunedì = 1 ... domenica = 64. */
export const dayBit = (weekday: number) => 1 << weekday;
export const daysFromList = (days: number[]) => days.reduce((m, d) => m | dayBit(d), 0);
export const daysToList = (mask: number) => [0, 1, 2, 3, 4, 5, 6].filter((d) => mask & dayBit(d));

export function describeDays(mask: number): string {
  if (mask === ALL_DAYS) return "Ogni giorno";
  if (mask === 31) return "Lunedì-venerdì";
  if (mask === 96) return "Sabato e domenica";
  return daysToList(mask).map((d) => DAY_LABELS[d]).join(", ");
}

/** Orari equidistanti tra due estremi (inclusi), per generare i promemoria dell'acqua. */
export function generateTimes(start: string, end: string, everyMinutes: number): string[] {
  const out: string[] = [];
  if (!isValidTime(start) || !isValidTime(end) || everyMinutes < 15) return out;
  for (let t = toMinutes(start); t <= toMinutes(end) && out.length < 12; t += everyMinutes) out.push(fromMinutes(t));
  return out;
}

/**
 * Se un promemoria è da inviare adesso restituisce lo "slot" (es. "2026-10-12 09:00"), altrimenti null.
 * L'invio parte entro `graceMin` minuti dall'orario scelto (il controllo gira ogni pochi minuti, e può slittare),
 * non si ripete per lo stesso orario e non recupera orari troppo vecchi.
 */
export function dueSlot(input: { now: Date; tz: string; times: string[]; daysMask: number; lastSlot: string | null; graceMin?: number }): string | null {
  const { now, tz, times, daysMask, lastSlot, graceMin = 25 } = input;
  const c = localClock(now, tz);
  if (!(daysMask & dayBit(c.weekday))) return null;
  const due = times.filter(isValidTime).map(toMinutes).filter((m) => m <= c.minutes && c.minutes - m <= graceMin);
  if (!due.length) return null;
  const slot = `${c.day} ${fromMinutes(Math.max(...due))}`;
  return slot === lastSlot ? null : slot;
}

/** Ore di silenzio, anche a cavallo della mezzanotte (es. 22:00-07:00). */
export function inQuietHours(nowMinutes: number, start: string | null, end: string | null): boolean {
  if (!start || !end || !isValidTime(start) || !isValidTime(end)) return false;
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === e) return false;
  return s < e ? nowMinutes >= s && nowMinutes < e : nowMinutes >= s || nowMinutes < e;
}

/** Sostituisce i segnaposto noti, lascia invariati gli altri. */
export function renderMessage(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export const pickMessage = (messages: string[], random = Math.random) => messages[Math.floor(random() * messages.length)] ?? "";

export const PLACEHOLDERS = {
  water: [
    ["{nome}", "il tuo nome"],
    ["{bevuti}", "acqua bevuta oggi"],
    ["{mancano}", "acqua che manca all'obiettivo"],
    ["{obiettivo}", "obiettivo di oggi"],
  ],
  motivation: [
    ["{nome}", "il tuo nome"],
    ["{settimana}", "allenamenti di questa settimana"],
    ["{serie}", "settimane di fila"],
  ],
} as const;

/** Messaggi e orari proposti alla creazione di un promemoria: l'utente li può cambiare del tutto. */
export const PRESETS = {
  water: {
    label: "Acqua",
    messages: ["Ora di bere un po' d'acqua, {nome}.", "Hai bevuto {bevuti} su {obiettivo}. Ne mancano {mancano}.", "Un bicchiere d'acqua adesso fa la differenza."],
    times: ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00"],
    days: ALL_DAYS,
    skipIfGoalMet: true,
  },
  motivation: {
    label: "Motivazione",
    messages: ["Oggi è un buon giorno per allenarsi, {nome}.", "La costanza batte la motivazione. Ti aspetto in palestra.", "Questa settimana hai fatto {settimana} allenamenti: continua così."],
    times: ["17:30"],
    days: ALL_DAYS,
    skipIfGoalMet: false,
  },
} as const;
