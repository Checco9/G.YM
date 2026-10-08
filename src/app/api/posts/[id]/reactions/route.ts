import { api, readJson } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { setReaction } from "@/modules/social/service";
import { z } from "zod";

export const PUT = api<{ id: string }>(async ({ req, user, params }) => {
  if (!z.string().uuid().safeParse(params.id).success) throw badRequest();
  await setReaction(user, params.id, await readJson(req, z.unknown()));
});
