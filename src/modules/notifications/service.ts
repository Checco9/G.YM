import { timingSafeEqual } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { dayKey, localClock, weekStartKey } from "@/lib/dates";
import { badRequest, notFound } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { dietGoals, notificationSettings, profiles, pushSubscriptions, reminders, waterLogs } from "@/db/schema";
import type { SessionUser } from "@/modules/auth/session";
import { loadHistory } from "@/modules/stats/repository";
import { weeklyStreak } from "@/modules/stats/domain/streak";
import { isAllowedPushEndpoint } from "./domain/endpoint";
import { dueSlot, inQuietHours, pickMessage, renderMessage } from "./domain/schedule";
import { reminderSchema, settingsSchema, subscriptionSchema, testSchema } from "./schemas";

// ───────── Configurazione ─────────

export const pushConfigured = () => Boolean(env().VAPID_PUBLIC_KEY && env().VAPID_PRIVATE_KEY);
export const vapidPublicKey = () => env().VAPID_PUBLIC_KEY ?? null;

let vapidReady = false;
function ensureVapid() {
  const e = env();
  if (!e.VAPID_PUBLIC_KEY || !e.VAPID_PRIVATE_KEY) throw badRequest("Le notifiche non sono attive su questa installazione");
  if (!vapidReady) {
    webpush.setVapidDetails(e.VAPID_SUBJECT || "mailto:admin@example.com", e.VAPID_PUBLIC_KEY, e.VAPID_PRIVATE_KEY);
    vapidReady = true;
  }
}

const extraHosts = () => (env().PUSH_ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim()).filter(Boolean);

// ───────── Lettura ─────────

export type ReminderView = {
  id: string;
  kind: "water" | "motivation";
  label: string;
  enabled: boolean;
  messages: string[];
  times: string[];
  days: number;
  skipIfGoalMet: boolean;
};
export type DeviceView = { id: string; label: string; createdAt: string };

function deviceLabel(ua: string | null): string {
  if (!ua) return "Dispositivo";
  if (/iPhone|iPad/.test(ua)) return "iPhone / iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  if (/Macintosh|Mac OS/.test(ua)) return "Mac";
  if (/Linux/.test(ua)) return "Linux";
  return "Dispositivo";
}

export async function getOverview(userId: string) {
  const [settings, list, devices] = await Promise.all([
    db().select().from(notificationSettings).where(eq(notificationSettings.userId, userId)).limit(1),
    db().select().from(reminders).where(eq(reminders.userId, userId)).orderBy(asc(reminders.createdAt)),
    db().select({ id: pushSubscriptions.id, userAgent: pushSubscriptions.userAgent, createdAt: pushSubscriptions.createdAt }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)).orderBy(desc(pushSubscriptions.createdAt)),
  ]);
  return {
    settings: { enabled: settings[0]?.enabled ?? true, quietStart: settings[0]?.quietStart ?? null, quietEnd: settings[0]?.quietEnd ?? null },
    reminders: list.map<ReminderView>((r) => ({ id: r.id, kind: r.kind, label: r.label, enabled: r.enabled, messages: r.messages, times: r.times, days: r.days, skipIfGoalMet: r.skipIfGoalMet })),
    devices: devices.map<DeviceView>((d) => ({ id: d.id, label: deviceLabel(d.userAgent), createdAt: d.createdAt.toISOString() })),
  };
}

// ───────── Impostazioni, dispositivi, promemoria ─────────

export async function saveSettings(userId: string, input: unknown) {
  const d = settingsSchema.parse(input);
  await db().insert(notificationSettings).values({ userId, ...d }).onConflictDoUpdate({ target: notificationSettings.userId, set: { ...d, updatedAt: new Date() } });
}

export async function subscribe(user: SessionUser, input: unknown, userAgent: string | null) {
  ensureVapid();
  const d = subscriptionSchema.parse(input);
  if (!isAllowedPushEndpoint(d.endpoint, extraHosts())) throw badRequest("Dispositivo non supportato");
  await rateLimit(`push-sub:${user.id}`, 20, 3600);
  const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id));
  if (n >= 10) throw badRequest("Hai collegato troppi dispositivi: rimuovine qualcuno");
  await db()
    .insert(pushSubscriptions)
    .values({ userId: user.id, endpoint: d.endpoint, p256dh: d.keys.p256dh, auth: d.keys.auth, userAgent: userAgent?.slice(0, 300) ?? null })
    // lo stesso browser usato con un altro account passa all'ultimo che ha attivato le notifiche
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: user.id, p256dh: d.keys.p256dh, auth: d.keys.auth, userAgent: userAgent?.slice(0, 300) ?? null, failures: 0 } });
}

export async function unsubscribe(userId: string, endpoint: string) {
  await db().delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

export async function removeDevice(userId: string, id: string) {
  const res = await db().delete(pushSubscriptions).where(and(eq(pushSubscriptions.id, id), eq(pushSubscriptions.userId, userId))).returning({ id: pushSubscriptions.id });
  if (!res.length) throw notFound("Dispositivo non trovato");
}

export async function createReminder(userId: string, input: unknown): Promise<ReminderView> {
  const d = reminderSchema.parse(input);
  const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(reminders).where(eq(reminders.userId, userId));
  if (n >= 20) throw badRequest("Puoi avere al massimo 20 promemoria");
  const [r] = await db().insert(reminders).values({ userId, ...d, skipIfGoalMet: d.kind === "water" && d.skipIfGoalMet }).returning();
  return { id: r.id, kind: r.kind, label: r.label, enabled: r.enabled, messages: r.messages, times: r.times, days: r.days, skipIfGoalMet: r.skipIfGoalMet };
}

export async function updateReminder(userId: string, id: string, input: unknown): Promise<ReminderView> {
  const d = reminderSchema.parse(input);
  const [r] = await db()
    .update(reminders)
    .set({ ...d, skipIfGoalMet: d.kind === "water" && d.skipIfGoalMet, lastSlot: null })
    .where(and(eq(reminders.id, id), eq(reminders.userId, userId)))
    .returning();
  if (!r) throw notFound("Promemoria non trovato");
  return { id: r.id, kind: r.kind, label: r.label, enabled: r.enabled, messages: r.messages, times: r.times, days: r.days, skipIfGoalMet: r.skipIfGoalMet };
}

export async function deleteReminder(userId: string, id: string) {
  const res = await db().delete(reminders).where(and(eq(reminders.id, id), eq(reminders.userId, userId))).returning({ id: reminders.id });
  if (!res.length) throw notFound("Promemoria non trovato");
}

// ───────── Invio ─────────

type Payload = { title: string; body: string; url: string; tag?: string };
type Sub = { id: string; endpoint: string; p256dh: string; auth: string; failures: number };

/** Invia a tutti i dispositivi dell'utente. Elimina quelli che il servizio push segnala come scaduti. */
async function sendToUser(userId: string, payload: Payload): Promise<{ sent: number; failed: number }> {
  ensureVapid();
  const subs: Sub[] = await db().select({ id: pushSubscriptions.id, endpoint: pushSubscriptions.endpoint, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth, failures: pushSubscriptions.failures }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      if (!isAllowedPushEndpoint(s.endpoint, extraHosts())) return;
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600, timeout: 10000 });
        sent++;
        await db().update(pushSubscriptions).set({ lastSuccessAt: new Date(), failures: 0 }).where(eq(pushSubscriptions.id, s.id));
      } catch (e) {
        failed++;
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410 || s.failures >= 4) await db().delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
        else await db().update(pushSubscriptions).set({ failures: s.failures + 1 }).where(eq(pushSubscriptions.id, s.id));
      }
    }),
  );
  return { sent, failed };
}

const fmtL = (ml: number) => `${(Math.round(ml / 10) / 100).toLocaleString("it-IT", { maximumFractionDigits: 2 })} L`;

async function waterToday(userId: string, tz: string) {
  const today = dayKey(new Date(), tz);
  const [w, g] = await Promise.all([
    db().select({ ml: waterLogs.ml }).from(waterLogs).where(and(eq(waterLogs.userId, userId), eq(waterLogs.loggedOn, today))).limit(1),
    db().select({ ml: dietGoals.waterMl }).from(dietGoals).where(eq(dietGoals.userId, userId)).limit(1),
  ]);
  return { ml: w[0]?.ml ?? 0, goal: g[0]?.ml ?? 2000 };
}

/** Compone il testo di un promemoria con i dati reali dell'utente (solo quelli che il messaggio usa). */
async function compose(r: { kind: "water" | "motivation"; messages: string[] }, who: { userId: string; name: string; tz: string }): Promise<Payload> {
  const template = pickMessage(r.messages);
  const vars: Record<string, string | number> = { nome: who.name };
  if (r.kind === "water" && /\{(bevuti|mancano|obiettivo)\}/.test(template)) {
    const w = await waterToday(who.userId, who.tz);
    Object.assign(vars, { bevuti: fmtL(w.ml), mancano: fmtL(Math.max(0, w.goal - w.ml)), obiettivo: fmtL(w.goal) });
  }
  if (r.kind === "motivation" && /\{(settimana|serie)\}/.test(template)) {
    const h = await loadHistory(who.userId);
    const keys = h.workouts.map((w) => dayKey(w.startedAt, who.tz));
    const today = dayKey(new Date(), who.tz);
    const ws = weekStartKey(today);
    Object.assign(vars, { settimana: keys.filter((k) => weekStartKey(k) === ws).length, serie: weeklyStreak(keys, today) });
  }
  return r.kind === "water"
    ? { title: "Acqua", body: renderMessage(template, vars), url: "/diet", tag: "water" }
    : { title: "G.YM", body: renderMessage(template, vars), url: "/home", tag: "motivation" };
}

export async function sendTest(user: SessionUser, input: unknown) {
  ensureVapid();
  const { reminderId } = testSchema.parse(input ?? {});
  await rateLimit(`push-test:${user.id}`, 20, 3600);
  let payload: Payload = { title: "G.YM", body: "Notifica di prova: tutto funziona.", url: "/home", tag: "test" };
  if (reminderId) {
    const [r] = await db().select().from(reminders).where(and(eq(reminders.id, reminderId), eq(reminders.userId, user.id))).limit(1);
    if (!r) throw notFound("Promemoria non trovato");
    payload = await compose(r, { userId: user.id, name: user.displayName, tz: user.timezone });
  }
  const res = await sendToUser(user.id, payload);
  if (res.sent === 0) throw badRequest(res.failed ? "Invio non riuscito: riattiva le notifiche su questo dispositivo" : "Nessun dispositivo collegato");
  return res;
}

// ───────── Invio programmato ─────────

export function checkCronSecret(header: string | null): boolean {
  const secret = env().CRON_SECRET;
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Chiamata ogni pochi minuti da uno scheduler esterno. Per ogni promemoria attivo verifica se è l'ora di inviarlo
 * nel fuso dell'utente, rispetta le ore di silenzio e l'interruttore generale, e non invia mai due volte lo stesso orario.
 */
export async function runDueReminders(now = new Date()) {
  if (!pushConfigured()) return { checked: 0, sent: 0, skipped: 0, note: "notifiche non configurate" };
  const rows = await db()
    .select({
      r: reminders,
      name: profiles.displayName,
      tz: profiles.timezone,
      enabled: notificationSettings.enabled,
      quietStart: notificationSettings.quietStart,
      quietEnd: notificationSettings.quietEnd,
    })
    .from(reminders)
    .innerJoin(profiles, eq(profiles.userId, reminders.userId))
    .leftJoin(notificationSettings, eq(notificationSettings.userId, reminders.userId))
    .where(and(eq(reminders.enabled, true), sql`exists (select 1 from push_subscriptions ps where ps.user_id = ${reminders.userId})`));

  let sent = 0;
  let skipped = 0;
  const water = new Map<string, Promise<{ ml: number; goal: number }>>();

  for (const row of rows) {
    if (row.enabled === false) continue;
    const { r } = row;
    const slot = dueSlot({ now, tz: row.tz, times: r.times, daysMask: r.days, lastSlot: r.lastSlot });
    if (!slot) continue;
    if (inQuietHours(localClock(now, row.tz).minutes, row.quietStart, row.quietEnd)) {
      skipped++;
      continue;
    }
    // "prenota" l'orario: se due controlli si sovrappongono, uno solo invia
    const claimed = await db().update(reminders).set({ lastSlot: slot }).where(and(eq(reminders.id, r.id), sql`${reminders.lastSlot} is distinct from ${slot}`)).returning({ id: reminders.id });
    if (!claimed.length) continue;

    if (r.kind === "water" && r.skipIfGoalMet) {
      const w = await (water.get(r.userId) ?? water.set(r.userId, waterToday(r.userId, row.tz)).get(r.userId)!);
      if (w.ml >= w.goal) {
        skipped++;
        continue;
      }
    }
    try {
      const payload = await compose(r, { userId: r.userId, name: row.name, tz: row.tz });
      const res = await sendToUser(r.userId, payload);
      sent += res.sent;
    } catch (e) {
      console.error("[notifiche] invio fallito:", e);
    }
  }
  return { checked: rows.length, sent, skipped };
}
