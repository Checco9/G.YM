import { api, readJson } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { deleteEntry, updateEntry } from "@/modules/diet/service";
import { z } from "zod";

const id = z.string().uuid();

export const PUT = api<{ id: string }>(async ({ req, user, params }) => {
  if (!id.safeParse(params.id).success) throw badRequest();
  return updateEntry(user.id, params.id, await readJson(req, z.unknown()));
});

export const DELETE = api<{ id: string }>(async ({ user, params }) => {
  if (!id.safeParse(params.id).success) throw badRequest();
  await deleteEntry(user.id, params.id);
});
