import { NextResponse } from "next/server";
import { checkCronSecret, runDueReminders } from "@/modules/notifications/service";

export const dynamic = "force-dynamic";

/** Chiamata da uno scheduler esterno ogni pochi minuti. Protetta da un segreto, senza sessione. */
async function handle(req: Request) {
  if (!checkCronSecret(req.headers.get("authorization"))) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  try {
    return NextResponse.json(await runDueReminders(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[cron] errore:", e);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}
export const GET = handle;
export const POST = handle;
