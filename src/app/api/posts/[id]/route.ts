import { api, readJson } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { deletePost, updatePost } from "@/modules/social/service";
import { z } from "zod";

const id = z.string().uuid();

export const PUT = api<{ id: string }>(async ({ req, user, params }) => {
  if (!id.safeParse(params.id).success) throw badRequest();
  await updatePost(user, params.id, await readJson(req, z.unknown()));
});

export const DELETE = api<{ id: string }>(async ({ user, params }) => {
  if (!id.safeParse(params.id).success) throw badRequest();
  await deletePost(user, params.id);
});
