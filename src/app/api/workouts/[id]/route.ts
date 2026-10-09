import { api, readJson } from "@/lib/http";
import { discardWorkout, saveWorkoutState } from "@/modules/workouts/service";
import { z } from "zod";
import { badRequest } from "@/lib/errors";

const id = z.string().uuid();

/** Autosave dello stato del workout in corso. */
export const PUT = api<{ id: string }>(async ({ req, user, params }) => {
  if (!id.safeParse(params.id).success) throw badRequest();
  await saveWorkoutState(user.id, params.id, await readJson(req, z.unknown()));
});

/** Scarta un workout in corso oppure elimina un allenamento dallo storico. */
export const DELETE = api<{ id: string }>(async ({ user, params }) => {
  if (!id.safeParse(params.id).success) throw badRequest();
  await discardWorkout(user.id, params.id);
});
