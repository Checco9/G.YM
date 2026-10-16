import { api } from "@/lib/http";
import { getDayActivity } from "@/modules/activity/service";

export const GET = api(async ({ req, user }) => getDayActivity(user, new URL(req.url).searchParams.get("date") ?? ""));
