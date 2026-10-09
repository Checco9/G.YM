import { z } from "zod";
import { MEAL_KEYS } from "./domain/nutrition";

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida");
const n = (min: number, max: number, msg = "Valore non valido") => z.number({ error: msg }).min(min, msg).max(max, msg);

export const foodSchema = z
  .object({
    name: z.string().trim().min(2, "Nome troppo corto").max(80),
    brand: z.string().trim().max(40).nullish(),
    unit: z.enum(["g", "ml"]).default("g"),
    kcal: n(0, 900, "Calorie non valide (0-900 per 100)"),
    protein: n(0, 100, "Proteine non valide"),
    carbs: n(0, 100, "Carboidrati non validi"),
    fat: n(0, 100, "Grassi non validi"),
    servingSize: n(1, 2000).nullish(),
    servingLabel: z.string().trim().max(30).nullish(),
  })
  .refine((f) => f.protein + f.carbs + f.fat <= 101, { message: "Proteine, carboidrati e grassi superano i 100 g", path: ["protein"] });

export const entrySchema = z
  .object({
    date: dateSchema,
    meal: z.enum(MEAL_KEYS),
    foodId: z.string().uuid().nullish(),
    quantity: n(0.1, 10000, "Quantità non valida"),
    /** Inserimento veloce senza alimento: valori totali della porzione */
    manual: z
      .object({
        name: z.string().trim().min(1, "Dai un nome").max(80),
        kcal: n(0, 10000),
        protein: n(0, 1000).default(0),
        carbs: n(0, 1000).default(0),
        fat: n(0, 1000).default(0),
      })
      .nullish(),
  })
  .refine((e) => Boolean(e.foodId) !== Boolean(e.manual), { message: "Scegli un alimento o inserisci i valori", path: ["foodId"] });

export const entryUpdateSchema = z.object({ quantity: n(0.1, 10000, "Quantità non valida") });
export const waterSchema = z.object({ date: dateSchema, delta: z.number().int().min(-5000).max(5000).refine((d) => d !== 0, "Valore non valido") });
export const copySchema = z.object({ fromDate: dateSchema, toDate: dateSchema, meal: z.enum(MEAL_KEYS).nullish() });

export const goalsSchema = z.object({
  kcal: z.number({ error: "Calorie non valide" }).int().min(800, "Minimo 800 kcal").max(6000, "Massimo 6000 kcal"),
  proteinG: z.number().int().min(0).max(500, "Proteine non valide"),
  carbsG: z.number().int().min(0).max(1000, "Carboidrati non validi"),
  fatG: z.number().int().min(0).max(400, "Grassi non validi"),
  waterMl: z.number().int().min(500, "Minimo 500 ml").max(8000, "Massimo 8000 ml"),
});
