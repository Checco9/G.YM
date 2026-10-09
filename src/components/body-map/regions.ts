/**
 * Geometria della mappa del corpo. Solo dati: per aggiungere un muscolo basta una nuova regione.
 * Coordinate in un viewBox 200 × 410, asse centrale x = 100.
 * Ogni percorso descrive il lato destro dell'immagine; il sinistro è lo specchio (vedi BodyMap).
 */
export type Region = {
  muscleId: string;
  /** percorsi riempiti con il colore del livello */
  paths: string[];
  /** linee di dettaglio (separazioni muscolari), tracciate con il colore dello sfondo */
  details?: string[];
};

export const VIEWBOX = "0 0 200 410";

/** Sagoma neutra: ciò che resta visibile tra un muscolo e l'altro. */
export const BASE_SHAPES = {
  head: "M100 8 C111 8 117 17 117 28 C117 40 110 48 100 48 C90 48 83 40 83 28 C83 17 89 8 100 8 Z",
  center: "M92 44 L108 44 L110 62 L90 62 Z",
  half: [
    // torso e bacino
    "M100 60 L128 64 C141 66 147 73 147 84 L147 112 C147 140 136 160 130 178 C132 192 138 202 138 214 L100 214 Z",
    // braccio
    "M141 72 C155 64 169 73 167 90 C166 112 163 132 162 148 C167 170 173 192 175 214 L160 220 C155 198 150 174 146 154 C142 132 141 110 141 72 Z",
    // mano
    "M158 214 C166 212 177 214 178 226 C178 238 170 244 164 242 C158 238 156 226 158 214 Z",
    // gamba
    "M101 206 L139 204 C141 240 135 270 131 292 C131 322 131 352 125 386 L111 386 C109 352 109 322 109 292 C105 270 100 240 101 206 Z",
    // piede
    "M110 384 L126 384 C130 392 134 400 132 404 L108 404 C106 396 108 390 110 384 Z",
  ],
} as const;

const DELT = "M140 73 C150 65 163 69 167 82 C169 94 165 105 159 111 C151 105 145 95 142 85 Z";
const ARM_UPPER = "M144 107 C150 113 158 113 164 107 C166 121 164 137 161 148 C155 151 149 151 146 148 C143 135 143 120 144 107 Z";
const FOREARM = "M147 155 C153 157 159 157 162 155 C168 175 173 195 174 213 C170 217 166 217 163 215 C157 197 151 177 147 155 Z";

export const FRONT: Region[] = [
  { muscleId: "neck", paths: ["M101 45 L107.5 45 L109.5 60 L101 62 Z"] },
  { muscleId: "chest", paths: ["M101 77 C111 70 127 70 140 76 C144 90 140 106 128 112 C118 116 106 113 101 108 Z"] },
  { muscleId: "delts", paths: [DELT] },
  { muscleId: "biceps", paths: [ARM_UPPER] },
  { muscleId: "forearms", paths: [FOREARM], details: ["M154 160 C158 176 162 192 164 206"] },
  {
    muscleId: "abs",
    paths: ["M101 117 L116 117 C118 135 118 155 115 177 C110 183 105 184 101 185 Z"],
    details: ["M101 133 L117 133", "M101 149 L117 149", "M101 165 L116 165"],
  },
  {
    muscleId: "obliques",
    paths: ["M119 117 C128 119 135 129 135 145 C135 159 131 170 125 179 C122 181 119 181 118 181 C121 161 121 137 119 117 Z"],
  },
  {
    muscleId: "adductors",
    paths: ["M102 207 C108 206 111 212 112 226 C113 246 113 268 112 286 C106 266 101 236 102 207 Z"],
  },
  {
    muscleId: "quads",
    paths: ["M110 199 C118 193 131 193 139 201 C141 233 137 263 131 288 C125 294 116 294 113 288 C113 262 111 232 110 199 Z"],
    details: ["M125 207 C127 237 125 263 121 285"],
  },
  { muscleId: "tibialis", paths: ["M113 305 C119 302 126 302 131 305 C131 335 128 361 124 379 C120 381 116 381 114 379 C111 359 111 333 113 305 Z"] },
];

export const BACK: Region[] = [
  { muscleId: "neck", paths: ["M101 45 L107.5 45 L108.5 54 L101 52 Z"] },
  { muscleId: "traps", paths: ["M101 54 C111 57 127 62 141 71 C137 80 126 87 116 96 C110 99 105 98 101 98 Z"] },
  { muscleId: "rhomboids", paths: ["M101 100 C108 100 114 102 117 106 C115 117 108 125 101 131 Z"] },
  { muscleId: "rear-delts", paths: [DELT] },
  {
    muscleId: "lats",
    paths: ["M116 104 C124 96 136 94 145 99 C147 120 141 150 129 171 C121 169 113 165 108 159 C113 141 116 122 116 104 Z"],
  },
  { muscleId: "triceps", paths: [ARM_UPPER], details: ["M154 114 C156 128 156 140 155 148"] },
  { muscleId: "forearms", paths: [FOREARM], details: ["M154 160 C158 176 162 192 164 206"] },
  { muscleId: "lower-back", paths: ["M101 134 C108 134 114 144 114 161 C114 171 110 179 101 183 Z"] },
  { muscleId: "glutes", paths: ["M101 187 C109 184 119 185 125 190 C127 203 124 217 121 227 C110 229 103 223 101 215 Z"] },
  { muscleId: "abductors", paths: ["M125 190 C131 183 139 185 141 193 C143 207 137 222 121 227 C124 217 127 203 125 190 Z"] },
  {
    muscleId: "hamstrings",
    paths: ["M103 232 C114 232 129 230 137 230 C139 256 135 274 131 288 C125 294 115 294 111 288 C107 271 103 252 103 232 Z"],
    details: ["M120 238 C122 258 121 276 118 288"],
  },
  { muscleId: "calves", paths: ["M111 301 C118 297 129 299 132 307 C134 329 130 353 125 371 C121 375 117 373 115 369 C111 351 109 325 111 301 Z"] },
];
