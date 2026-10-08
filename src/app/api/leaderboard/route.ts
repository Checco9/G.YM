import { api, readJson } from "@/lib/http";
import { setLeaderboardOptIn } from "@/modules/gamification/service";
import { z } from "zod";

export const PUT = api(async ({ req, user }) => {
  const { optIn } = await readJson(req, z.object({ optIn: z.boolean() }));
  await setLeaderboardOptIn(user.id, optIn);
});
