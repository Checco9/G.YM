import { api, readJson } from "@/lib/http";
import { createChallenge } from "@/modules/gamification/service";
import { z } from "zod";

export const POST = api(async ({ req, user }) => createChallenge(user.id, user.timezone, await readJson(req, z.unknown())));
