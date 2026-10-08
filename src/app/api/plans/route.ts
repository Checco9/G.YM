import { api, readJson } from "@/lib/http";
import { createPlan } from "@/modules/workouts/service";
import { z } from "zod";

export const POST = api(async ({ req, user }) => createPlan(user.id, await readJson(req, z.unknown())));
