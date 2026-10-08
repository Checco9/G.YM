import { NextResponse, type NextRequest } from "next/server";

/** CSP con nonce per richiesta: blocca script iniettati (XSS) pur permettendo gli script di Next. */
export function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== "production";
  // le foto dei post arrivano direttamente da Supabase Storage
  const photoHost = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).origin : "";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${photoHost}`.trim(),
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico|icon.*|apple-icon.*|manifest.webmanifest).*)" }],
};
