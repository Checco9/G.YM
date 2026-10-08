import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { PHOTO_PATH_RE, readLocalPhoto } from "@/modules/social/storage";

/** Solo sviluppo/test (PHOTO_STORAGE=local): in produzione le foto sono servite da Supabase. */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (env().PHOTO_STORAGE !== "local") return new NextResponse(null, { status: 404 });
  const p = (await ctx.params).path.join("/");
  if (!PHOTO_PATH_RE.test(p)) return new NextResponse(null, { status: 404 });
  const data = await readLocalPhoto(p);
  if (!data) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(data), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" } });
}
