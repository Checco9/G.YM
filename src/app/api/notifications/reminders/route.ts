import { api, readJson } from "@/lib/http";
import { createReminder } from "@/modules/notifications/service";
import { z } from "zod";

export const POST = api(async ({ req, user }) => createReminder(user.id, await readJson(req, z.unknown())));
