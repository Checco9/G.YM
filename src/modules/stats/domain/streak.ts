import { addDaysToKey, daysBetweenKeys, weekStartKey } from "@/lib/dates";

/**
 * Streak settimanale: settimane consecutive (lun–dom) con almeno un allenamento.
 * La settimana corrente non interrompe la serie se è ancora vuota: si conta da quella precedente.
 * `dayKeys` sono giorni "YYYY-MM-DD" nel fuso dell'utente, `todayKey` è oggi.
 */
export function weeklyStreak(dayKeys: string[], todayKey: string): number {
  const weeks = new Set(dayKeys.map(weekStartKey));
  let cursor = weekStartKey(todayKey);
  if (!weeks.has(cursor)) cursor = addDaysToKey(cursor, -7);
  let streak = 0;
  while (weeks.has(cursor)) {
    streak++;
    cursor = addDaysToKey(cursor, -7);
  }
  return streak;
}

/** Media di allenamenti a settimana sulle ultime `weeks` settimane (inclusa quella in corso). */
export function averagePerWeek(dayKeys: string[], todayKey: string, weeks = 8): number {
  const from = addDaysToKey(weekStartKey(todayKey), -7 * (weeks - 1));
  const n = dayKeys.filter((k) => daysBetweenKeys(from, k) >= 0 && daysBetweenKeys(k, todayKey) >= 0).length;
  return Math.round((n / weeks) * 10) / 10;
}
