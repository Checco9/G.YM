import { api, readJson } from "@/lib/http";
import { createFood, listFoods } from "@/modules/diet/service";
import { z } from "zod";

export const GET = api(async ({ user }) => ({ foods: await listFoods(user.id) }));
export const POST = api(async ({ req, user }) => createFood(user.id, await readJson(req, z.unknown())));
