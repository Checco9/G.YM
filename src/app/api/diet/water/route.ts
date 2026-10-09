import { api, readJson } from "@/lib/http";
import { addWater } from "@/modules/diet/service";
import { z } from "zod";

export const PUT = api(async ({ req, user }) => addWater(user, await readJson(req, z.unknown())));
