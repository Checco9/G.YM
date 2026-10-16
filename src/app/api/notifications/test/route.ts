import { api, readJson } from "@/lib/http";
import { sendTest } from "@/modules/notifications/service";
import { z } from "zod";

export const POST = api(async ({ req, user }) => sendTest(user, await readJson(req, z.unknown())));
