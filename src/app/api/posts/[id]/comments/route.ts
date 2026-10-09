import { api, readJson } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { addComment } from "@/modules/social/service";
import { z } from "zod";

export const POST = api<{ id: string }>(async ({ req, user, params }) => {
  if (!z.string().uuid().safeParse(params.id).success) throw badRequest();
  return addComment(user, params.id, await readJson(req, z.unknown()));
});
