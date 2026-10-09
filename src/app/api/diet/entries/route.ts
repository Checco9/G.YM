import { api, readJson } from "@/lib/http";
import { addEntry } from "@/modules/diet/service";
import { z } from "zod";

export const POST = api(async ({ req, user }) => addEntry(user, await readJson(req, z.unknown())));
