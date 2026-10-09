import { api } from "@/lib/http";
import { lastSetsFor } from "@/modules/workouts/service";
import { z } from "zod";
import { badRequest } from "@/lib/errors";

/** Serie dell'ultima sessione conclusa di un esercizio (per precompilare un workout). */
export const GET = api<{ id: string }>(async ({ user, params }) => {
  if (!z.string().uuid().safeParse(params.id).success) throw badRequest();
  const map = await lastSetsFor(user.id, [params.id]);
  return { sets: map.get(params.id) ?? [] };
});
