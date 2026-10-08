import { api, readJson } from "@/lib/http";
import { createPost } from "@/modules/social/service";
import { z } from "zod";

export const POST = api(async ({ req, user }) => createPost(user, await readJson(req, z.unknown())));
