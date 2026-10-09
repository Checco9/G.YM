import { api } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { deleteComment } from "@/modules/social/service";
import { z } from "zod";

export const DELETE = api<{ id: string }>(async ({ user, params }) => {
  if (!z.string().uuid().safeParse(params.id).success) throw badRequest();
  await deleteComment(user, params.id);
});
