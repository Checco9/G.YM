import { api } from "@/lib/http";
import { deleteExercise } from "@/modules/exercises/service";
import { z } from "zod";
import { badRequest } from "@/lib/errors";

export const DELETE = api<{ id: string }>(async ({ user, params }) => {
  if (!z.string().uuid().safeParse(params.id).success) throw badRequest();
  await deleteExercise(user.id, params.id);
});
