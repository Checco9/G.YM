import type { SetRecord } from "@/modules/stats/domain/types";

/**
 * Serie iniziali per un esercizio appena aggiunto al workout:
 * si ripete l'ultima sessione (peso e ripetizioni per ogni serie); senza storico, valori vuoti
 * con il numero di serie e ripetizioni obiettivo della scheda.
 */
export function prefillSets(
  last: SetRecord[] | null,
  target: { sets: number; reps: number },
): SetRecord[] {
  if (last && last.length) return last.map((s) => ({ weightKg: s.weightKg, reps: s.reps }));
  return Array.from({ length: target.sets }, () => ({ weightKg: 0, reps: target.reps }));
}
