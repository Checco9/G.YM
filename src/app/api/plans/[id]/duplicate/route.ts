import { api } from "@/lib/http";
import { duplicatePlan } from "@/modules/workouts/service";
import { z } from "zod";
import { badRequest } from "@/lib/errors";

export const POST = api<{ id: string }>(async ({ user, params }) => {
  if (!z.string().uuid().safeParse(params.id).success) throw badRequest();
  return duplicatePlan(user.id, params.id);
});
