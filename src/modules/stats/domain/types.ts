/** Forma minima di uno storico, indipendente dal database. Tutte le funzioni di dominio lavorano su questo. */
export type SetRecord = { weightKg: number; reps: number };

export type HistoricalWorkout = {
  id: string;
  name: string;
  startedAt: Date;
  endedAt: Date | null;
  exercises: { exerciseId: string; sets: SetRecord[] }[];
};
