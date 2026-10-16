/**
 * Il server invia le notifiche all'indirizzo fornito dal browser. Per evitare che qualcuno faccia
 * contattare al server indirizzi arbitrari (SSRF), si accettano solo i servizi push dei browser noti.
 */
const ALLOWED_SUFFIXES = ["fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com", "android.googleapis.com"];

export function isAllowedPushEndpoint(endpoint: string, extraHosts: string[] = []): boolean {
  let u: URL;
  try {
    u = new URL(endpoint);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  const ok = (suffix: string) => host === suffix || host.endsWith("." + suffix);
  return ALLOWED_SUFFIXES.some(ok) || extraHosts.some((h) => host === h.toLowerCase());
}
