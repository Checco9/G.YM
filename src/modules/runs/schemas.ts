import { z } from "zod";

const kind = z.enum(["outdoor", "treadmill"]);

export const startRunSchema = z.object({ kind: kind.default("outdoor") });

/** Stato inviato dal cronometro: salvataggio continuo, ripetibile in sicurezza. */
export const runStateSchema = z.object({
  kind,
  elapsedS: z.number().int().min(0).max(86400),
  running: z.boolean(),
  distanceM: z.number().int().min(0).max(300000),
  notes: z.string().trim().max(500).nullish(),
});

export const finishRunSchema = z.object({
  kind,
  elapsedS: z.number().int().min(60, "Servono almeno 1 minuto di corsa").max(86400),
  distanceM: z.number().int().min(100, "Inserisci la distanza percorsa").max(300000),
  effort: z.number().int().min(1).max(10).nullish(),
  notes: z.string().trim().max(500).nullish(),
});

export const manualRunSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Orario non valido").default("07:00"),
  kind,
  distanceM: z.number().int().min(100, "Inserisci la distanza").max(300000, "Distanza non valida"),
  durationS: z.number().int().min(60, "Durata non valida").max(172800, "Durata non valida"),
  effort: z.number().int().min(1).max(10).nullish(),
  notes: z.string().trim().max(500).nullish(),
});
