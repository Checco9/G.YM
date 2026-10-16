import { api, readJson } from "@/lib/http";
import { saveSettings } from "@/modules/notifications/service";
import { z } from "zod";

export const PUT = api(async ({ req, user }) => {
  await saveSettings(user.id, await readJson(req, z.unknown()));
});
