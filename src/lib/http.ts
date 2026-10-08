import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { HttpError, badRequest, forbidden } from "./errors";
import { env } from "./env";
import { requireApiUser, type SessionUser } from "@/modules/auth/session";

type Ctx<P> = { req: Request; user: SessionUser; params: P };
type PublicCtx<P> = { req: Request; params: P };

/** Protezione CSRF per le richieste che modificano dati: l'Origin deve coincidere con il nostro host. */
function checkOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) throw forbidden("Origine mancante");
  const configured = env().APP_ORIGIN;
  if (configured) {
    if (origin !== configured.replace(/\/$/, "")) throw forbidden("Origine non consentita");
    return;
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {}
  if (!host || originHost !== host) throw forbidden("Origine non consentita");
}

function toResponse(e: unknown) {
  if (e instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of e.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
    return NextResponse.json({ error: Object.values(fields)[0] ?? "Dati non validi", fields }, { status: 400 });
  }
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message, fields: e.fields }, { status: e.status });
  }
  console.error("[api] errore non gestito:", e);
  return NextResponse.json({ error: "Errore interno. Riprova." }, { status: 500 });
}

/** Handler autenticato: sessione, CSRF, mappatura errori. */
export function api<P = Record<string, never>>(fn: (c: Ctx<P>) => Promise<unknown>) {
  return async (req: Request, ctx: { params: Promise<P> }) => {
    try {
      checkOrigin(req);
      const user = await requireApiUser();
      const params = await ctx.params;
      const result = await fn({ req, user, params });
      return NextResponse.json(result ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      return toResponse(e);
    }
  };
}

/** Handler pubblico (login e registrazione): stessi controlli, senza sessione. */
export function publicApi<P = Record<string, never>>(fn: (c: PublicCtx<P>) => Promise<unknown>) {
  return async (req: Request, ctx: { params: Promise<P> }) => {
    try {
      checkOrigin(req);
      const params = await ctx.params;
      const result = await fn({ req, params });
      return NextResponse.json(result ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      return toResponse(e);
    }
  };
}

export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 200_000) throw badRequest("Richiesta troppo grande");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("JSON non valido");
  }
  return schema.parse(body);
}
