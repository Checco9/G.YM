import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db, type DbOrTx } from "@/lib/db";
import { exerciseMuscles, exercises, strengthStandards } from "@/db/schema";

export type ExerciseRow = {
  id: string;
  name: string;
  category: "compound" | "isolation" | "bodyweight";
  isCustom: boolean;
  muscles: { muscleId: string; role: "primary" | "secondary" }[];
};

async function queryVisibleExercises(userId: string): Promise<ExerciseRow[]> {
  const rows = await db()
    .select()
    .from(exercises)
    .where(and(isNull(exercises.archivedAt), or(isNull(exercises.ownerId), eq(exercises.ownerId, userId))))
    .orderBy(asc(exercises.name));
  if (!rows.length) return [];
  const links = await db()
    .select()
    .from(exerciseMuscles)
    .where(inArray(exerciseMuscles.exerciseId, rows.map((r) => r.id)));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    isCustom: r.ownerId !== null,
    muscles: links.filter((l) => l.exerciseId === r.id).map((l) => ({ muscleId: l.muscleId, role: l.role })),
  }));
}

/** Verifica che tutti gli id esistano e siano accessibili all'utente. */
export async function assertExercisesAccessible(userId: string, ids: string[], tx: DbOrTx = db()) {
  const unique = [...new Set(ids)];
  if (!unique.length) return true;
  const rows = await tx
    .select({ id: exercises.id })
    .from(exercises)
    .where(and(inArray(exercises.id, unique), or(isNull(exercises.ownerId), eq(exercises.ownerId, userId))));
  return rows.length === unique.length;
}

export async function insertCustomExercise(
  userId: string,
  data: { name: string; category: "compound" | "isolation" | "bodyweight"; primaryMuscles: string[] },
) {
  return db().transaction(async (tx) => {
    const [ex] = await tx
      .insert(exercises)
      .values({ ownerId: userId, name: data.name, category: data.category })
      .returning({ id: exercises.id });
    await tx
      .insert(exerciseMuscles)
      .values([...new Set(data.primaryMuscles)].map((muscleId) => ({ exerciseId: ex.id, muscleId, role: "primary" as const })));
    return ex.id;
  });
}

export async function archiveCustomExercise(userId: string, id: string) {
  const res = await db()
    .update(exercises)
    .set({ archivedAt: new Date() })
    .where(and(eq(exercises.id, id), eq(exercises.ownerId, userId)))
    .returning({ id: exercises.id });
  return res.length > 0;
}

/**
 * Esercizi visibili all'utente (di sistema + propri). Cache di un'ora, invalidata con il tag
 * `exercises:<userId>` quando l'utente crea o elimina un esercizio.
 */
export const listVisibleExercises = (userId: string): Promise<ExerciseRow[]> =>
  unstable_cache(() => queryVisibleExercises(userId), ["visible-exercises", userId], {
    revalidate: 3600,
    tags: [`exercises:${userId}`, "catalog"],
  })();

/** Soglie e collegamenti esercizio-muscolo cambiano solo con il seed: cache di un'ora. */
export const listStandards = unstable_cache(async () => db().select().from(strengthStandards), ["strength-standards"], {
  revalidate: 3600,
  tags: ["catalog"],
});

export const listExerciseMuscleLinks = unstable_cache(async () => db().select().from(exerciseMuscles), ["exercise-muscle-links"], {
  revalidate: 3600,
  tags: ["catalog"],
});
