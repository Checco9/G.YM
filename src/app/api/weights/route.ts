import { api, readJson } from "@/lib/http";
import { addWeight } from "@/modules/body/service";
import { z } from "zod";

export const POST = api(async ({ req, user }) => addWeight(user.id, await readJson(req, z.unknown())));
