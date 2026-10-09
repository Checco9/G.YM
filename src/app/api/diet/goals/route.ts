import { api, readJson } from "@/lib/http";
import { saveGoals } from "@/modules/diet/service";
import { z } from "zod";

export const PUT = api(async ({ req, user }) => {
  await saveGoals(user.id, await readJson(req, z.unknown()));
});
