import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL mancante"),
  REGISTRATION_CODE: z.string().optional(),
  APP_ORIGIN: z.string().optional(),
  // Foto dei post: Supabase Storage (la chiave "service role" resta solo sul server)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_BUCKET: z.string().optional(),
  // Notifiche push (chiavi VAPID: `npm run vapid`) e segreto per l'invio programmato
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  CRON_SECRET: z.string().min(16).optional(),
  // Open Food Facts (scanner dei codici a barre): nessuna chiave richiesta
  OFF_BASE_URL: z.string().url().optional(),
  /** Contatto indicato nello User-Agent, come richiesto dal servizio (es. la tua email) */
  OFF_CONTACT: z.string().max(100).optional(),
  OFF_TIMEOUT_MS: z.string().optional(),
  /** Host push aggiuntivi consentiti, separati da virgola (solo test) */
  PUSH_ALLOWED_HOSTS: z.string().optional(),
  /** "local": salva in .uploads (solo per sviluppo e test) */
  PHOTO_STORAGE: z.string().optional(),
  NODE_ENV: z.string().optional(),
});

let cached: z.infer<typeof schema> | null = null;

/** Le variabili vengono lette solo lato server e validate al primo utilizzo. */
export function env() {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}
