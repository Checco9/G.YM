import { api } from "@/lib/http";
import { deleteChallenge } from "@/modules/gamification/service";
import { z } from "zod";
import { badRequest } from "@/lib/errors";

export const DELETE = api<{ id: string }>(async ({ user, params }) => {
  if (!z.string().uuid().safeParse(params.id).success) throw badRequest();
  await deleteChallenge(user.id, params.id);
});
