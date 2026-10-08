import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { profiles } from "@/db/schema";

function validTz(tz: string) {
  try {
    new Intl.DateTimeFormat("it-IT", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Inserisci un nome").max(40),
  sex: z.enum(["male", "female"]).nullable(),
  heightCm: z.number().int().min(100).max(250).nullable(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  timezone: z.string().refine(validTz, "Fuso orario non valido"),
  weeklyTarget: z.number().int().min(1).max(14),
});

export async function updateProfile(userId: string, input: unknown) {
  const d = profileSchema.parse(input);
  await db().update(profiles).set({ ...d, updatedAt: new Date() }).where(eq(profiles.userId, userId));
}
