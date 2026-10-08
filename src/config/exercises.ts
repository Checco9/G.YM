import type { MuscleId } from "./muscles";

/**
 * Catalogo degli esercizi di sistema.
 *
 * `standards` contiene le soglie dei livelli come rapporto tra 1RM stimato e
 * peso corporeo, per un uomo: [intermedio, avanzato, elite].
 * Per le donne si moltiplica per `femaleFactor`.
 * Sono valori indicativi (derivati da tabelle di forza comuni): modificali qui
 * e rilancia `npm run db:seed` per aggiornarli. Nessun'altra parte del codice li conosce.
 * Gli esercizi senza `standards` (es. a corpo libero) restano non classificati.
 */
export type CatalogExercise = {
  slug: string;
  name: string;
  category: "compound" | "isolation" | "bodyweight";
  primary: MuscleId[];
  secondary?: MuscleId[];
  standards?: [number, number, number];
  femaleFactor?: number;
};

const BASE_CATALOG: CatalogExercise[] = [
  // Petto
  { slug: "bench-press", name: "Panca piana", category: "compound", primary: ["chest"], secondary: ["delts", "triceps"], standards: [0.75, 1.25, 1.75], femaleFactor: 0.6 },
  { slug: "incline-bench-press", name: "Panca inclinata", category: "compound", primary: ["chest"], secondary: ["delts", "triceps"], standards: [0.6, 1.0, 1.4], femaleFactor: 0.6 },
  { slug: "chest-press-machine", name: "Chest press", category: "compound", primary: ["chest"], secondary: ["delts", "triceps"], standards: [0.7, 1.2, 1.7], femaleFactor: 0.6 },
  { slug: "dumbbell-bench-press", name: "Panca piana con manubri", category: "compound", primary: ["chest"], secondary: ["delts", "triceps"], standards: [0.3, 0.5, 0.75], femaleFactor: 0.6 },
  { slug: "cable-fly", name: "Croci ai cavi", category: "isolation", primary: ["chest"], standards: [0.2, 0.4, 0.6], femaleFactor: 0.6 },
  { slug: "dumbbell-fly", name: "Croci con manubri", category: "isolation", primary: ["chest"], standards: [0.12, 0.22, 0.35], femaleFactor: 0.6 },
  { slug: "push-up", name: "Piegamenti", category: "bodyweight", primary: ["chest"], secondary: ["delts", "triceps"] },
  // Spalle
  { slug: "overhead-press", name: "Military press", category: "compound", primary: ["delts"], secondary: ["triceps", "traps"], standards: [0.5, 0.8, 1.1], femaleFactor: 0.6 },
  { slug: "shoulder-press-machine", name: "Shoulder press", category: "compound", primary: ["delts"], secondary: ["triceps"], standards: [0.5, 0.85, 1.2], femaleFactor: 0.6 },
  { slug: "dumbbell-shoulder-press", name: "Shoulder press con manubri", category: "compound", primary: ["delts"], secondary: ["triceps"], standards: [0.25, 0.4, 0.6], femaleFactor: 0.6 },
  { slug: "lateral-raise", name: "Alzate laterali", category: "isolation", primary: ["delts"], standards: [0.08, 0.15, 0.25], femaleFactor: 0.6 },
  { slug: "rear-delt-fly", name: "Alzate posteriori", category: "isolation", primary: ["rear-delts"], secondary: ["traps"], standards: [0.08, 0.15, 0.25], femaleFactor: 0.6 },
  { slug: "face-pull", name: "Face pull", category: "isolation", primary: ["rear-delts"], secondary: ["traps"], standards: [0.2, 0.4, 0.6], femaleFactor: 0.6 },
  // Bicipiti e avambracci
  { slug: "barbell-curl", name: "Curl con bilanciere", category: "isolation", primary: ["biceps"], secondary: ["forearms"], standards: [0.35, 0.6, 0.9], femaleFactor: 0.6 },
  { slug: "dumbbell-curl", name: "Curl con manubri", category: "isolation", primary: ["biceps"], secondary: ["forearms"], standards: [0.15, 0.28, 0.4], femaleFactor: 0.6 },
  { slug: "hammer-curl", name: "Curl a martello", category: "isolation", primary: ["biceps", "forearms"], standards: [0.17, 0.3, 0.45], femaleFactor: 0.6 },
  { slug: "wrist-curl", name: "Curl per avambracci", category: "isolation", primary: ["forearms"], standards: [0.2, 0.4, 0.65], femaleFactor: 0.6 },
  // Tricipiti
  { slug: "triceps-pushdown", name: "Pushdown", category: "isolation", primary: ["triceps"], standards: [0.4, 0.75, 1.1], femaleFactor: 0.6 },
  { slug: "skull-crusher", name: "French press", category: "isolation", primary: ["triceps"], standards: [0.3, 0.55, 0.85], femaleFactor: 0.6 },
  { slug: "overhead-triceps-extension", name: "Estensioni sopra la testa", category: "isolation", primary: ["triceps"], standards: [0.25, 0.45, 0.7], femaleFactor: 0.6 },
  { slug: "close-grip-bench-press", name: "Panca presa stretta", category: "compound", primary: ["triceps"], secondary: ["chest", "delts"], standards: [0.65, 1.1, 1.5], femaleFactor: 0.6 },
  { slug: "dip", name: "Dip", category: "bodyweight", primary: ["triceps", "chest"] },
  // Schiena
  { slug: "lat-pulldown", name: "Lat machine", category: "compound", primary: ["lats"], secondary: ["biceps"], standards: [0.6, 1.0, 1.5], femaleFactor: 0.6 },
  { slug: "barbell-row", name: "Rematore con bilanciere", category: "compound", primary: ["lats"], secondary: ["traps", "rear-delts", "biceps", "lower-back"], standards: [0.6, 1.0, 1.5], femaleFactor: 0.6 },
  { slug: "seated-cable-row", name: "Pulley", category: "compound", primary: ["lats"], secondary: ["biceps", "rear-delts", "traps"], standards: [0.6, 1.0, 1.5], femaleFactor: 0.6 },
  { slug: "dumbbell-row", name: "Rematore con manubrio", category: "compound", primary: ["lats"], secondary: ["biceps", "rear-delts"], standards: [0.25, 0.45, 0.7], femaleFactor: 0.6 },
  { slug: "pull-up", name: "Trazioni", category: "bodyweight", primary: ["lats"], secondary: ["biceps"] },
  { slug: "shrug", name: "Scrollate", category: "isolation", primary: ["traps"], secondary: ["forearms"], standards: [0.75, 1.25, 1.75], femaleFactor: 0.6 },
  { slug: "deadlift", name: "Stacco da terra", category: "compound", primary: ["lower-back", "glutes", "hamstrings"], secondary: ["traps", "forearms", "quads"], standards: [1.0, 1.75, 2.5], femaleFactor: 0.7 },
  { slug: "back-extension", name: "Hyperextension", category: "isolation", primary: ["lower-back"], secondary: ["glutes", "hamstrings"], standards: [0.2, 0.4, 0.7], femaleFactor: 0.7 },
  // Gambe
  { slug: "squat", name: "Squat", category: "compound", primary: ["quads"], secondary: ["glutes", "hamstrings"], standards: [1.0, 1.5, 2.0], femaleFactor: 0.7 },
  { slug: "front-squat", name: "Front squat", category: "compound", primary: ["quads"], secondary: ["glutes"], standards: [0.8, 1.25, 1.7], femaleFactor: 0.7 },
  { slug: "leg-press", name: "Leg press", category: "compound", primary: ["quads"], secondary: ["glutes", "hamstrings"], standards: [1.5, 2.5, 3.5], femaleFactor: 0.7 },
  { slug: "hack-squat", name: "Hack squat", category: "compound", primary: ["quads"], secondary: ["glutes"], standards: [1.0, 1.75, 2.5], femaleFactor: 0.7 },
  { slug: "lunge", name: "Affondi", category: "compound", primary: ["quads", "glutes"], secondary: ["hamstrings"], standards: [0.4, 0.7, 1.0], femaleFactor: 0.7 },
  { slug: "leg-extension", name: "Leg extension", category: "isolation", primary: ["quads"], standards: [0.5, 0.9, 1.3], femaleFactor: 0.7 },
  { slug: "leg-curl", name: "Leg curl", category: "isolation", primary: ["hamstrings"], standards: [0.4, 0.7, 1.0], femaleFactor: 0.7 },
  { slug: "romanian-deadlift", name: "Stacco rumeno", category: "compound", primary: ["hamstrings"], secondary: ["glutes", "lower-back"], standards: [0.9, 1.4, 1.9], femaleFactor: 0.7 },
  { slug: "hip-thrust", name: "Hip thrust", category: "compound", primary: ["glutes"], secondary: ["hamstrings"], standards: [1.0, 1.75, 2.5], femaleFactor: 0.8 },
  { slug: "standing-calf-raise", name: "Calf in piedi", category: "isolation", primary: ["calves"], standards: [1.0, 1.75, 2.5], femaleFactor: 0.7 },
  { slug: "seated-calf-raise", name: "Calf da seduto", category: "isolation", primary: ["calves"], standards: [0.7, 1.25, 1.8], femaleFactor: 0.7 },
  { slug: "tibialis-raise", name: "Tibiale raise", category: "isolation", primary: ["tibialis"], standards: [0.2, 0.4, 0.7], femaleFactor: 0.7 },
  // Core
  { slug: "crunch", name: "Addominali", category: "bodyweight", primary: ["abs"] },
  { slug: "cable-crunch", name: "Crunch ai cavi", category: "isolation", primary: ["abs"], standards: [0.4, 0.8, 1.2], femaleFactor: 0.7 },
  { slug: "hanging-leg-raise", name: "Sollevamento gambe alla sbarra", category: "bodyweight", primary: ["abs"] },
];

type Row = [slug: string, name: string, category: CatalogExercise["category"], primary: MuscleId[], secondary: MuscleId[], standards?: [number, number, number], femaleFactor?: number];
const compact = (rows: Row[]): CatalogExercise[] =>
  rows.map(([slug, name, category, primary, secondary, standards, femaleFactor]) => ({
    slug, name, category, primary, secondary, standards, femaleFactor: femaleFactor ?? (standards ? 0.65 : undefined),
  }));

/** Esercizi aggiunti nella V2. Stesse regole: soglie indicative, modificabili e ricaricabili con `npm run db:seed`. */
const V2_CATALOG: CatalogExercise[] = compact([
  // Petto
  ["decline-bench-press", "Panca declinata", "compound", ["chest"], ["triceps", "delts"], [0.8, 1.3, 1.8]],
  ["incline-dumbbell-press", "Panca inclinata con manubri", "compound", ["chest"], ["delts", "triceps"], [0.27, 0.45, 0.65]],
  ["pec-deck", "Pec deck", "isolation", ["chest"], [], [0.4, 0.75, 1.1]],
  ["cable-crossover-low", "Croci ai cavi dal basso", "isolation", ["chest"], ["delts"], [0.15, 0.3, 0.5]],
  ["machine-dip", "Dip alla macchina", "compound", ["chest", "triceps"], ["delts"], [0.7, 1.2, 1.7]],
  ["landmine-press", "Landmine press", "compound", ["delts", "chest"], ["triceps"], [0.3, 0.5, 0.75]],
  // Spalle e trapezi
  ["arnold-press", "Arnold press", "compound", ["delts"], ["triceps"], [0.22, 0.38, 0.55]],
  ["front-raise", "Alzate frontali", "isolation", ["delts"], [], [0.08, 0.15, 0.25]],
  ["cable-lateral-raise", "Alzate laterali ai cavi", "isolation", ["delts"], [], [0.06, 0.12, 0.2]],
  ["machine-lateral-raise", "Alzate laterali alla macchina", "isolation", ["delts"], [], [0.2, 0.4, 0.65]],
  ["upright-row", "Tirate al mento", "compound", ["delts", "traps"], ["biceps"], [0.4, 0.7, 1.0]],
  ["reverse-pec-deck", "Pec deck inverso", "isolation", ["rear-delts"], ["rhomboids"], [0.2, 0.4, 0.65]],
  ["dumbbell-shrug", "Scrollate con manubri", "isolation", ["traps"], ["forearms"], [0.3, 0.55, 0.8]],
  // Bicipiti, avambracci
  ["preacher-curl", "Curl su panca Scott", "isolation", ["biceps"], ["forearms"], [0.3, 0.5, 0.75]],
  ["ez-bar-curl", "Curl con bilanciere EZ", "isolation", ["biceps"], ["forearms"], [0.3, 0.55, 0.8]],
  ["incline-dumbbell-curl", "Curl su panca inclinata", "isolation", ["biceps"], [], [0.12, 0.22, 0.34]],
  ["cable-curl", "Curl ai cavi", "isolation", ["biceps"], ["forearms"], [0.25, 0.45, 0.7]],
  ["concentration-curl", "Curl concentrato", "isolation", ["biceps"], [], [0.12, 0.22, 0.34]],
  ["reverse-curl", "Curl inverso", "isolation", ["forearms", "biceps"], [], [0.2, 0.4, 0.6]],
  ["wrist-extension", "Estensioni del polso", "isolation", ["forearms"], [], [0.12, 0.25, 0.4]],
  // Tricipiti
  ["rope-pushdown", "Pushdown con corda", "isolation", ["triceps"], [], [0.35, 0.65, 1.0]],
  ["triceps-kickback", "Kickback per tricipiti", "isolation", ["triceps"], [], [0.07, 0.14, 0.22]],
  ["bench-dip", "Dip tra due panche", "bodyweight", ["triceps"], ["chest", "delts"]],
  // Schiena
  ["t-bar-row", "Rematore al T-bar", "compound", ["lats", "rhomboids"], ["biceps", "rear-delts", "lower-back"], [0.5, 0.9, 1.3]],
  ["chest-supported-row", "Rematore con appoggio al petto", "compound", ["lats", "rhomboids"], ["biceps", "rear-delts"], [0.5, 0.9, 1.3]],
  ["wide-cable-row", "Pulley presa larga", "compound", ["rhomboids", "lats"], ["rear-delts", "biceps"], [0.5, 0.9, 1.3]],
  ["wide-lat-pulldown", "Lat machine presa larga", "compound", ["lats"], ["biceps", "rhomboids"], [0.55, 0.95, 1.4]],
  ["close-grip-pulldown", "Lat machine presa stretta", "compound", ["lats"], ["biceps"], [0.55, 0.95, 1.4]],
  ["straight-arm-pulldown", "Pulldown a braccia tese", "isolation", ["lats"], ["triceps"], [0.3, 0.55, 0.85]],
  ["pendlay-row", "Rematore Pendlay", "compound", ["lats", "rhomboids"], ["lower-back", "biceps"], [0.55, 0.95, 1.4]],
  ["rack-pull", "Rack pull", "compound", ["traps", "lower-back"], ["glutes", "hamstrings", "forearms"], [1.2, 2.0, 2.8], 0.7],
  ["chin-up", "Chin-up", "bodyweight", ["lats", "biceps"], []],
  ["assisted-pull-up", "Trazioni assistite", "bodyweight", ["lats"], ["biceps"]],
  ["inverted-row", "Rematore inverso", "bodyweight", ["rhomboids", "lats"], ["biceps", "rear-delts"]],
  ["good-morning", "Good morning", "compound", ["lower-back", "hamstrings"], ["glutes"], [0.5, 0.9, 1.3], 0.7],
  // Gambe e glutei
  ["sumo-deadlift", "Stacco sumo", "compound", ["glutes", "adductors", "hamstrings"], ["quads", "lower-back"], [1.0, 1.75, 2.5], 0.7],
  ["trap-bar-deadlift", "Stacco con trap bar", "compound", ["quads", "glutes", "hamstrings"], ["lower-back", "traps"], [1.1, 1.85, 2.6], 0.7],
  ["goblet-squat", "Goblet squat", "compound", ["quads", "glutes"], ["adductors"], [0.3, 0.55, 0.8], 0.7],
  ["smith-squat", "Squat al multipower", "compound", ["quads", "glutes"], ["hamstrings"], [0.9, 1.4, 1.9], 0.7],
  ["bulgarian-split-squat", "Squat bulgaro", "compound", ["quads", "glutes"], ["adductors"], [0.3, 0.5, 0.75], 0.7],
  ["walking-lunge", "Affondi camminati", "compound", ["quads", "glutes"], ["hamstrings", "adductors"], [0.3, 0.55, 0.8], 0.7],
  ["reverse-lunge", "Affondi indietro", "compound", ["quads", "glutes"], ["hamstrings"], [0.35, 0.6, 0.9], 0.7],
  ["step-up", "Step-up", "compound", ["quads", "glutes"], ["calves"], [0.3, 0.5, 0.75], 0.7],
  ["lying-leg-curl", "Leg curl da sdraiato", "isolation", ["hamstrings"], ["calves"], [0.4, 0.7, 1.0], 0.7],
  ["seated-leg-curl", "Leg curl da seduto", "isolation", ["hamstrings"], [], [0.4, 0.7, 1.0], 0.7],
  ["hip-abduction-machine", "Abduzioni alla macchina", "isolation", ["abductors"], ["glutes"], [0.6, 1.1, 1.7], 0.8],
  ["hip-adduction-machine", "Adduzioni alla macchina", "isolation", ["adductors"], [], [0.6, 1.1, 1.7], 0.8],
  ["cable-kickback", "Kickback ai cavi per glutei", "isolation", ["glutes"], ["hamstrings"], [0.1, 0.2, 0.35], 0.8],
  ["glute-bridge", "Ponte per glutei", "compound", ["glutes"], ["hamstrings"], [0.8, 1.5, 2.2], 0.8],
  ["cable-pull-through", "Pull-through ai cavi", "compound", ["glutes", "hamstrings"], ["lower-back"], [0.3, 0.6, 0.9], 0.8],
  ["nordic-curl", "Nordic curl", "bodyweight", ["hamstrings"], ["calves"]],
  ["donkey-calf-raise", "Calf alla macchina donkey", "isolation", ["calves"], [], [1.0, 1.75, 2.5], 0.7],
  ["leg-press-calf-raise", "Calf alla leg press", "isolation", ["calves"], [], [1.0, 1.8, 2.6], 0.7],
  ["sissy-squat", "Sissy squat", "bodyweight", ["quads"], []],
  // Core e collo
  ["russian-twist", "Russian twist", "isolation", ["obliques"], ["abs"], [0.1, 0.25, 0.4], 0.7],
  ["cable-woodchop", "Woodchop ai cavi", "isolation", ["obliques"], ["abs"], [0.15, 0.3, 0.5], 0.7],
  ["pallof-press", "Pallof press", "isolation", ["obliques"], ["abs"], [0.1, 0.2, 0.35], 0.7],
  ["side-bend", "Flessioni laterali con manubrio", "isolation", ["obliques"], [], [0.2, 0.4, 0.65], 0.7],
  ["side-plank", "Side plank dinamico", "bodyweight", ["obliques"], ["abs"]],
  ["ab-wheel", "Ab wheel", "bodyweight", ["abs"], ["obliques"]],
  ["decline-sit-up", "Sit-up declinato", "bodyweight", ["abs"], []],
  ["neck-curl", "Flessioni del collo", "isolation", ["neck"], [], [0.05, 0.1, 0.18], 0.7],
  ["neck-extension", "Estensioni del collo", "isolation", ["neck"], ["traps"], [0.05, 0.1, 0.18], 0.7],
]);

export const EXERCISE_CATALOG: CatalogExercise[] = [...BASE_CATALOG, ...V2_CATALOG];
