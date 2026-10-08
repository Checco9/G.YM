import { api, readJson } from "@/lib/http";
import { deleteWeight, updateWeight } from "@/modules/body/service";
import { z } from "zod";
import { badRequest } from "@/lib/errors";

const id = z.string().uuid();

export const PUT = api<{ id: string }>(async ({ req, user, params }) => {
  if (!id.safeParse(params.id).success) throw badRequest();
  await updateWeight(user.id, params.id, await readJson(req, z.unknown()));
});

export const DELETE = api<{ id: string }>(async ({ user, params }) => {
  if (!id.safeParse(params.id).success) throw badRequest();
  await deleteWeight(user.id, params.id);
});
