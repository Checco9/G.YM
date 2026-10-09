import { z } from "zod";
import { MUSCLES } from "@/config/muscles";

const muscleIds = MUSCLES.map((m) => m.id) as [string, ...string[]];

export const createExerciseSchema = z.object({
  name: z.string().trim().min(2, "Nome troppo corto").max(60),
  category: z.enum(["compound", "isolation", "bodyweight"]).default("compound"),
  primaryMuscles: z.array(z.enum(muscleIds)).min(1, "Scegli almeno un muscolo").max(4),
});
