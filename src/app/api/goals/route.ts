import { api, readJson } from "@/lib/http";
import { createGoal } from "@/modules/goals/service";
import { loadHistory } from "@/modules/stats/repository";
import { z } from "zod";

export const POST = api(async ({ req, user }) => {
  const body = await readJson(req, z.unknown());
  return createGoal(user.id, body, await loadHistory(user.id), user.timezone);
});
