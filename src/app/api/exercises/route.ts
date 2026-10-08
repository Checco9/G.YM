import { api, readJson } from "@/lib/http";
import { createExercise } from "@/modules/exercises/service";
import { z } from "zod";

export const POST = api(async ({ req, user }) => createExercise(user.id, await readJson(req, z.unknown())));
