import { api, readJson } from "@/lib/http";
import { subscribe } from "@/modules/notifications/service";
import { z } from "zod";

export const POST = api(async ({ req, user }) => {
  await subscribe(user, await readJson(req, z.unknown()), req.headers.get("user-agent"));
});
