import { z } from "zod";

const uuid = z.string().uuid();

export const planSchema = z.object({
  name: z.string().trim().min(1, "Dai un nome alla scheda").max(60),
  notes: z.string().trim().max(500).nullish(),
  exercises: z
    .array(
      z.object({
        exerciseId: uuid,
        targetSets: z.number().int().min(1).max(20),
        targetReps: z.number().int().min(1).max(100),
      }),
    )
    .max(40),
});

export const startWorkoutSchema = z.object({
  planId: uuid.nullish(),
  name: z.string().trim().max(60).optional(),
});

const setSchema = z.object({
  id: uuid,
  weightKg: z.number().min(0).max(1000),
  reps: z.number().int().min(0).max(1000),
  completed: z.boolean(),
});

/** Stato completo del workout in corso: l'autosave invia sempre tutto (idempotente, last-write-wins). */
export const workoutStateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  notes: z.string().trim().max(1000).nullish(),
  exercises: z
    .array(
      z.object({
        id: uuid,
        exerciseId: uuid,
        sets: z.array(setSchema).max(50),
      }),
    )
    .max(40),
});

export const finishWorkoutSchema = workoutStateSchema.extend({
  /** true = elimina le serie non completate (le statistiche contano solo quelle completate) */
  discardIncomplete: z.boolean().default(true),
});

export type WorkoutState = z.infer<typeof workoutStateSchema>;
