/** Passo in secondi al chilometro; null se non calcolabile. */
export function paceSecPerKm(distanceM: number, durationS: number): number | null {
  if (distanceM < 100 || durationS <= 0) return null;
  return durationS / (distanceM / 1000);
}

export function fmtPace(secPerKm: number | null): string {
  if (secPerKm === null || !Number.isFinite(secPerKm)) return "—";
  const total = Math.round(secPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** 1:05:09 oppure 24:30 */
export function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`;
}

/** "1:30:00", "45:10" o "90" (minuti) -> secondi; null se non valido. */
export function parseDuration(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return parseInt(t, 10) * 60;
  const parts = t.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d{1,2}$/.test(p))) return null;
  const n = parts.map(Number);
  const [h, m, s] = parts.length === 3 ? n : [0, n[0], n[1]];
  if (m > 59 || s > 59) return null;
  return h * 3600 + m * 60 + s;
}

export type RunLite = { id: string; startedAt: Date; distanceM: number; durationS: number };

/** Record personali delle corse: la più lunga e il miglior passo (solo da 3 km in su, per non falsare con scatti brevi). */
export function runRecords(runs: RunLite[]) {
  let longest: RunLite | null = null;
  let best: { run: RunLite; pace: number } | null = null;
  for (const r of runs) {
    if (!longest || r.distanceM > longest.distanceM) longest = r;
    const p = r.distanceM >= 3000 ? paceSecPerKm(r.distanceM, r.durationS) : null;
    if (p !== null && (!best || p < best.pace)) best = { run: r, pace: p };
  }
  return { longest, bestPace: best };
}
