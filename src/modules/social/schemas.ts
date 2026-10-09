import { z } from "zod";
import { PHOTO_PATH_RE } from "./storage";
import { REACTION_KEYS } from "./types";

const photo = z.object({
  path: z.string().regex(PHOTO_PATH_RE, "Foto non valida"),
  width: z.number().int().min(1).max(4096),
  height: z.number().int().min(1).max(4096),
});

export const createPostSchema = z.object({
  workoutId: z.string().uuid(),
  caption: z.string().trim().max(500, "Massimo 500 caratteri").default(""),
  photo: photo.nullish(),
});

/** photo: assente = invariata, null = rimossa, oggetto = sostituita */
export const updatePostSchema = z.object({
  caption: z.string().trim().max(500, "Massimo 500 caratteri"),
  photo: photo.nullish(),
});

export const commentSchema = z.object({ body: z.string().trim().min(1, "Scrivi qualcosa").max(500, "Massimo 500 caratteri") });
export const reactionSchema = z.object({ key: z.enum(REACTION_KEYS), on: z.boolean() });
