import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, sessions, users } from "@/db/schema";
import { unauthorized } from "@/lib/errors";

const COOKIE = "ghisa_session";
const TTL_MS = 30 * 24 * 3600 * 1000;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  sex: "male" | "female" | null;
  heightCm: number | null;
  birthDate: string | null;
  timezone: string;
  weeklyTarget: number;
  leaderboardOptIn: boolean;
};

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db().insert(sessions).values({ id: sha256(token), userId, expiresAt });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db().delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(COOKIE);
}

/** Utente della sessione corrente, o null. Memoizzato per richiesta. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await db()
    .select({
      id: users.id,
      email: users.email,
      displayName: profiles.displayName,
      sex: profiles.sex,
      heightCm: profiles.heightCm,
      birthDate: profiles.birthDate,
      timezone: profiles.timezone,
      weeklyTarget: profiles.weeklyTarget,
      leaderboardOptIn: profiles.leaderboardOptIn,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
});

/** Per le pagine: reindirizza al login se non autenticato. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Per le API: 401 se non autenticato. */
export async function requireApiUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}
