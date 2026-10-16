import { api, readJson } from "@/lib/http";
import { createManualRun, startRun } from "@/modules/runs/service";
import { z } from "zod";

/** `mode: "manual"` registra una corsa già fatta, altrimenti avvia il cronometro. */
export const POST = api(async ({ req, user }) => {
  const body = (await readJson(req, z.object({ mode: z.enum(["start", "manual"]).default("start") }).passthrough())) as { mode: string };
  return body.mode === "manual" ? createManualRun(user, body) : startRun(user.id, body);
});
