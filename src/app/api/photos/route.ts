import { randomUUID } from "node:crypto";
import { api } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { getStorage, MAX_PHOTO_BYTES, parseJpeg } from "@/modules/social/storage";

/**
 * Carica una foto (già ridimensionata e ricompressa in JPEG dal browser, che elimina anche l'EXIF/GPS).
 * Il server non si fida: controlla dimensione, firma JPEG e limita la frequenza.
 */
export const POST = api(async ({ req, user }) => {
  const storage = getStorage();
  if (!storage) throw badRequest("Le foto non sono attive su questa installazione");
  await rateLimit(`photo:${user.id}`, 30, 3600);

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_PHOTO_BYTES) throw badRequest("Foto troppo grande");
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_PHOTO_BYTES) throw badRequest("Foto troppo grande");
  const dims = parseJpeg(buf);
  if (!dims || dims.width > 4096 || dims.height > 4096) throw badRequest("Formato foto non valido");

  const path = `${user.id}/${randomUUID()}.jpg`;
  await storage.put(path, buf);
  return { path, url: storage.url(path), width: dims.width, height: dims.height };
});
