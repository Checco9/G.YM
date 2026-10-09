import { api, readJson } from "@/lib/http";
import { finishWorkout } from "@/modules/workouts/service";
import { z } from "zod";
import { badRequest } from "@/lib/errors";

export const POST = api<{ id: string }>(async ({ req, user, params }) => {
  if (!z.string().uuid().safeParse(params.id).success) throw badRequest();
  return finishWorkout(user.id, params.id, await readJson(req, z.unknown()));
});
