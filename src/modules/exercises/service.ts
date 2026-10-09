import { revalidateTag } from "next/cache";
import { notFound } from "@/lib/errors";
import { archiveCustomExercise, insertCustomExercise, listVisibleExercises } from "./repository";
import { createExerciseSchema } from "./schemas";

export const getExercises = (userId: string) => listVisibleExercises(userId);

export async function createExercise(userId: string, input: unknown) {
  const data = createExerciseSchema.parse(input);
  const id = await insertCustomExercise(userId, data);
  revalidateTag(`exercises:${userId}`);
  return { id };
}

export async function deleteExercise(userId: string, id: string) {
  if (!(await archiveCustomExercise(userId, id))) throw notFound("Esercizio non trovato");
  revalidateTag(`exercises:${userId}`);
}
