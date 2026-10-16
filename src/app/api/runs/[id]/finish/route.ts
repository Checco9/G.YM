import { api, readJson } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { finishRun } from "@/modules/runs/service";
import { z } from "zod";

export const POST = api<{ id: string }>(async ({ req, user, params }) => {
  if (!z.string().uuid().safeParse(params.id).success) throw badRequest();
  return finishRun(user.id, params.id, await readJson(req, z.unknown()));
});
