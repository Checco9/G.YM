/**
 * Gruppi muscolari di sistema.
 * Per aggiungerne uno: inseriscilo qui, associa gli esercizi nel catalogo,
 * aggiungi la regione SVG in components/body-map/regions.ts e lancia `npm run db:seed`.
 */
export const MUSCLES = [
  { id: "chest", name: "Petto", sortOrder: 10 },
  { id: "delts", name: "Deltoidi", sortOrder: 20 },
  { id: "biceps", name: "Bicipiti", sortOrder: 30 },
  { id: "forearms", name: "Avambracci", sortOrder: 40 },
  { id: "abs", name: "Addominali", sortOrder: 50 },
  { id: "quads", name: "Quadricipiti", sortOrder: 60 },
  { id: "obliques", name: "Obliqui", sortOrder: 55 },
  { id: "adductors", name: "Adduttori", sortOrder: 65 },
  { id: "tibialis", name: "Tibiali", sortOrder: 70 },
  { id: "neck", name: "Collo", sortOrder: 80 },
  { id: "traps", name: "Trapezio", sortOrder: 110 },
  { id: "rhomboids", name: "Romboidi", sortOrder: 115 },
  { id: "lats", name: "Dorsali", sortOrder: 120 },
  { id: "rear-delts", name: "Deltoidi posteriori", sortOrder: 130 },
  { id: "triceps", name: "Tricipiti", sortOrder: 140 },
  { id: "lower-back", name: "Lombari", sortOrder: 150 },
  { id: "glutes", name: "Glutei", sortOrder: 160 },
  { id: "abductors", name: "Abduttori (medio gluteo)", sortOrder: 165 },
  { id: "hamstrings", name: "Femorali", sortOrder: 170 },
  { id: "calves", name: "Polpacci", sortOrder: 180 },
] as const;

export type MuscleId = (typeof MUSCLES)[number]["id"];

export const MUSCLE_NAME: Record<string, string> = Object.fromEntries(
  MUSCLES.map((m) => [m.id, m.name]),
);
