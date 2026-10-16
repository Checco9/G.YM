import { api, readJson } from "@/lib/http";
import { unsubscribe } from "@/modules/notifications/service";
import { z } from "zod";

export const POST = api(async ({ req, user }) => {
  const { endpoint } = await readJson(req, z.object({ endpoint: z.string().max(1000) }));
  await unsubscribe(user.id, endpoint);
});
