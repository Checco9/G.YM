import { publicApi, readJson } from "@/lib/http";
import { clientIp } from "@/lib/rate-limit";
import { register } from "@/modules/auth/service";
import { z } from "zod";

export const POST = publicApi(async ({ req }) => {
  const body = await readJson(req, z.unknown());
  await register(body, clientIp(req));
});
