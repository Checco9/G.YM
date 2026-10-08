import { eq } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { badRequest, conflict, forbidden, HttpError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { profiles, users } from "@/db/schema";
import { dummyHash, hashPassword, verifyPassword } from "./password";
import { createSession } from "./session";
import { loginSchema, registerSchema } from "./schemas";

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function register(input: unknown, ip: string) {
  await rateLimit(`register:${ip}`, 5, 3600);
  const data = registerSchema.parse(input);

  const required = env().REGISTRATION_CODE;
  if (required && !safeEqual(data.code ?? "", required)) throw forbidden("Codice di registrazione non valido");

  const exists = await db().select({ id: users.id }).from(users).where(eq(users.email, data.email)).limit(1);
  if (exists.length) throw conflict("Esiste già un account con questa email");

  const passwordHash = await hashPassword(data.password);
  const userId = await db().transaction(async (tx) => {
    const [u] = await tx.insert(users).values({ email: data.email, passwordHash }).returning({ id: users.id });
    await tx.insert(profiles).values({ userId: u.id, displayName: data.displayName });
    return u.id;
  });
  await createSession(userId);
}

export async function login(input: unknown, ip: string) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) throw badRequest("Email o password non corretti");
  const { email, password } = parsed.data;

  await rateLimit(`login-ip:${ip}`, 30, 900);
  await rateLimit(`login-email:${email}`, 8, 900);

  const [user] = await db().select().from(users).where(eq(users.email, email)).limit(1);
  const ok = user ? await verifyPassword(user.passwordHash, password) : (await verifyPassword(await dummyHash(), password), false);
  if (!user || !ok) throw new HttpError(401, "Email o password non corretti");
  await createSession(user.id);
}
