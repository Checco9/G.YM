import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

/**
 * Storage delle foto. In produzione Supabase Storage con bucket pubblico: le immagini sono servite
 * direttamente dalla CDN di Supabase (non passano dalla nostra app, quindi non rallentano nulla).
 * I percorsi contengono un UUID casuale e non sono elencabili.
 */
export type PhotoStorage = {
  put(storagePath: string, data: Buffer): Promise<void>;
  remove(paths: string[]): Promise<void>;
  url(storagePath: string): string;
};

const MAX_BYTES = 2 * 1024 * 1024;

function supabase(url: string, key: string, bucket: string): PhotoStorage {
  const base = url.replace(/\/$/, "");
  const headers = { Authorization: `Bearer ${key}`, apikey: key };
  let ready: Promise<void> | null = null;

  /** Crea il bucket pubblico alla prima scrittura (se esiste già, 409: va bene). */
  const ensureBucket = () =>
    (ready ??= fetch(`${base}/storage/v1/bucket`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ id: bucket, name: bucket, public: true, file_size_limit: MAX_BYTES, allowed_mime_types: ["image/jpeg"] }),
    }).then(async (r) => {
      if (!r.ok && r.status !== 409 && !(await r.text()).includes("already exists")) {
        ready = null;
        throw new Error(`Creazione bucket fallita (${r.status})`);
      }
    }));

  return {
    async put(p, data) {
      await ensureBucket();
      const r = await fetch(`${base}/storage/v1/object/${bucket}/${p}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
        body: new Uint8Array(data),
      });
      if (!r.ok) throw new Error(`Upload fallito (${r.status})`);
    },
    async remove(paths) {
      if (!paths.length) return;
      await fetch(`${base}/storage/v1/object/${bucket}`, {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: paths }),
      }).catch(() => {});
    },
    url: (p) => `${base}/storage/v1/object/public/${bucket}/${p}`,
  };
}

const LOCAL_DIR = path.join(process.cwd(), ".uploads");
const local: PhotoStorage = {
  async put(p, data) {
    const file = path.join(LOCAL_DIR, p);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
  },
  async remove(paths) {
    await Promise.all(paths.map((p) => rm(path.join(LOCAL_DIR, p), { force: true })));
  },
  url: (p) => `/api/photos/file/${p}`,
};

export async function readLocalPhoto(p: string): Promise<Buffer | null> {
  const file = path.join(LOCAL_DIR, p);
  if (!file.startsWith(LOCAL_DIR + path.sep)) return null;
  return readFile(file).catch(() => null);
}

let cached: PhotoStorage | null | undefined;

/** null = foto disattivate (variabili non configurate): i post funzionano comunque, senza immagine. */
export function getStorage(): PhotoStorage | null {
  if (cached !== undefined) return cached;
  const e = env();
  if (e.PHOTO_STORAGE === "local") cached = local;
  else if (e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY) cached = supabase(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, e.SUPABASE_BUCKET || "post-photos");
  else cached = null;
  return cached;
}

export const MAX_PHOTO_BYTES = MAX_BYTES;
export const PHOTO_PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/;

/** Verifica i primi byte (JPEG) e legge le dimensioni dal marker SOF. Null se non è un JPEG valido. */
export function parseJpeg(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01 || marker === 0xff) {
      i += marker === 0xff ? 1 : 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    if ((marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = buf.readUInt16BE(i + 5);
      const width = buf.readUInt16BE(i + 7);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    i += 2 + len;
  }
  return null;
}
