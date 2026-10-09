import { api } from "@/lib/http";
import { getFeedPage } from "@/modules/social/service";

export const GET = api(async ({ req, user }) => {
  const cursor = new URL(req.url).searchParams.get("cursor");
  return getFeedPage(user.id, cursor);
});
