import { api, readJson } from "@/lib/http";
import { saveDaily } from "@/modules/daily/service";
import { z } from "zod";

export const PUT = api(async ({ req, user }) => saveDaily(user, await readJson(req, z.unknown())));
