/** Oltre queste ripetizioni la stima del massimale non è affidabile: la serie non conta. */
export const MAX_REPS_FOR_ESTIMATE = 12;

/** Formula di Epley. Con 1 ripetizione il massimale è il carico stesso. */
export function estimateOneRepMax(weightKg: number, reps: number): number | null {
  if (!(weightKg > 0) || !(reps >= 1) || reps > MAX_REPS_FOR_ESTIMATE) return null;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 100) / 100;
}
