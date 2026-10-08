import { api } from "@/lib/http";
import { deleteGoal } from "@/modules/goals/service";
import { z } from "zod";
import { badRequest } from "@/lib/errors";

export const DELETE = api<{ id: string }>(async ({ user, params }) => {
  if (!z.string().uuid().safeParse(params.id).success) throw badRequest();
  await deleteGoal(user.id, params.id);
});
