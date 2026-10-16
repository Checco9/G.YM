import { api } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { removeDevice } from "@/modules/notifications/service";
import { z } from "zod";

export const DELETE = api<{ id: string }>(async ({ user, params }) => {
  if (!z.string().uuid().safeParse(params.id).success) throw badRequest();
  await removeDevice(user.id, params.id);
});
