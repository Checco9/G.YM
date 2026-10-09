import { api, readJson } from "@/lib/http";
import { copyEntries } from "@/modules/diet/service";
import { z } from "zod";

export const POST = api(async ({ req, user }) => ({ entries: await copyEntries(user, await readJson(req, z.unknown())) }));
