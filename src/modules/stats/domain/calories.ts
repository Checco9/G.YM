/**
 * Calorie bruciate: stime teoriche con il metodo dei MET (calorie = MET × peso in kg × ore).
 * Sono ordini di grandezza utili per confrontare gli allenamenti, non misure: l'errore tipico è del 20-30%.
 * Il valore comprende il metabolismo a riposo (stima lorda).
 */
const r5 = (n: number) => Math.round(n / 5) * 5;

/** MET di una sessione di pesi in base a quanto è fitta: serie completate al minuto. */
export function strengthMet(setsPerMinute: number): number {
  if (setsPerMinute < 0.15) return 3.0;
  if (setsPerMinute < 0.25) return 3.5;
  if (setsPerMinute < 0.35) return 4.5;
  return 5.5;
}

export function workoutCalories(input: { weightKg: number | null; durationMin: number | null; sets: number }): number | null {
  const { weightKg, durationMin, sets } = input;
  if (!weightKg || !durationMin || durationMin < 5 || sets < 1) return null;
  const minutes = Math.min(durationMin, 240);
  return r5(strengthMet(sets / minutes) * weightKg * (minutes / 60));
}

/** MET della corsa o camminata dalla velocità (equazioni ACSM: 0,1 ml/kg/min per metro in cammino, 0,2 in corsa). */
export function runMet(speedKmh: number): number {
  const mPerMin = (speedKmh * 1000) / 60;
  const vo2 = (speedKmh < 7 ? 0.1 : 0.2) * mPerMin + 3.5;
  return Math.max(2.5, vo2 / 3.5);
}

export function runCalories(input: { weightKg: number | null; distanceM: number; durationS: number }): number | null {
  const { weightKg, distanceM, durationS } = input;
  if (!weightKg || distanceM <= 0 || durationS < 60) return null;
  const speedKmh = distanceM / 1000 / (durationS / 3600);
  if (speedKmh > 30) return null;
  return r5(runMet(speedKmh) * weightKg * (durationS / 3600));
}

/** Peso valido alla data: l'ultima misurazione fino a quel giorno, altrimenti la prima disponibile. `entries` in ordine di data. */
export function weightOn(entries: { measuredOn: string; weightKg: number }[], dateKey: string): number | null {
  if (!entries.length) return null;
  let found = entries[0].weightKg;
  for (const e of entries) {
    if (e.measuredOn <= dateKey) found = e.weightKg;
    else break;
  }
  return found;
}
