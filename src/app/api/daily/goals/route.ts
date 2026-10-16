import { api, readJson } from "@/lib/http";
import { saveDailyGoals } from "@/modules/daily/service";
import { z } from "zod";

export const PUT = api(async ({ req, user }) => {
  await saveDailyGoals(user.id, await readJson(req, z.unknown()));
});
