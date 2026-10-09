import { publicApi } from "@/lib/http";
import { destroySession } from "@/modules/auth/session";

export const POST = publicApi(async () => {
  await destroySession();
});
