import { api, readJson } from "@/lib/http";
import { startWorkout } from "@/modules/workouts/service";
import { z } from "zod";

export const POST = api(async ({ req, user }) => startWorkout(user.id, await readJson(req, z.unknown())));
