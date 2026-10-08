import { api, readJson } from "@/lib/http";
import { updateProfile } from "@/modules/profile/service";
import { z } from "zod";

export const PUT = api(async ({ req, user }) => {
  await updateProfile(user.id, await readJson(req, z.unknown()));
});
