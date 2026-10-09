import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email non valida").max(254),
  password: z.string().min(10, "Almeno 10 caratteri").max(128),
  displayName: z.string().trim().min(1, "Inserisci il tuo nome").max(40),
  code: z.string().max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});
