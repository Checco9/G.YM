import { z } from "zod";
import { isValidTime } from "./domain/schedule";

const time = z.string().refine(isValidTime, "Orario non valido");

export const reminderSchema = z.object({
  kind: z.enum(["water", "motivation"]),
  label: z.string().trim().min(1, "Dai un nome al promemoria").max(40),
  enabled: z.boolean().default(true),
  messages: z.array(z.string().trim().min(1, "Il messaggio non può essere vuoto").max(140, "Massimo 140 caratteri")).min(1, "Scrivi almeno un messaggio").max(10),
  times: z
    .array(time)
    .min(1, "Scegli almeno un orario")
    .max(12)
    .transform((t) => [...new Set(t)].sort()),
  days: z.number().int().min(1, "Scegli almeno un giorno").max(127),
  skipIfGoalMet: z.boolean().default(false),
});

export const settingsSchema = z.object({
  enabled: z.boolean(),
  quietStart: time.nullable(),
  quietEnd: time.nullable(),
});

export const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(10).max(100) }),
});

export const testSchema = z.object({ reminderId: z.string().uuid().nullish() });
