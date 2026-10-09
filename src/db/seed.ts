import { drizzle } from "drizzle-orm/postgres-js";
import { eq, isNull, and } from "drizzle-orm";
import postgres from "postgres";
import * as s from "./schema";
import { MUSCLES } from "../config/muscles";
import { EXERCISE_CATALOG } from "../config/exercises";
import { FOOD_CATALOG } from "../config/foods";

/** Seed idempotente: si può rilanciare a ogni deploy per aggiornare catalogo e soglie. */
async function main() {
  // MIGRATION_DATABASE_URL (facoltativa): connessione diretta/session per le migrazioni, se il pooler desse problemi.
  const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL mancante");
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  const client = postgres(url, { max: 1, prepare: false, ssl: isLocal ? false : "require" });
  const db = drizzle(client, { schema: s });

  await db.transaction(async (tx) => {
    for (const m of MUSCLES) {
      await tx.insert(s.muscleGroups).values(m).onConflictDoUpdate({
        target: s.muscleGroups.id,
        set: { name: m.name, sortOrder: m.sortOrder },
      });
    }

    for (const ex of EXERCISE_CATALOG) {
      const [row] = await tx
        .insert(s.exercises)
        .values({ slug: ex.slug, name: ex.name, category: ex.category, ownerId: null })
        .onConflictDoUpdate({ target: s.exercises.slug, set: { name: ex.name, category: ex.category } })
        .returning({ id: s.exercises.id });

      await tx.delete(s.exerciseMuscles).where(eq(s.exerciseMuscles.exerciseId, row.id));
      const links = [
        ...ex.primary.map((muscleId) => ({ exerciseId: row.id, muscleId, role: "primary" as const })),
        ...(ex.secondary ?? []).map((muscleId) => ({ exerciseId: row.id, muscleId, role: "secondary" as const })),
      ];
      await tx.insert(s.exerciseMuscles).values(links);

      await tx.delete(s.strengthStandards).where(eq(s.strengthStandards.exerciseId, row.id));
      if (ex.standards) {
        const [int, adv, elite] = ex.standards;
        const levels = [
          ["beginner", 0],
          ["intermediate", int],
          ["advanced", adv],
          ["elite", elite],
        ] as const;
        const rows = (["male", "female"] as const).flatMap((sex) =>
          levels.map(([level, ratio]) => ({
            exerciseId: row.id,
            sex,
            level,
            minRatio: Math.round(ratio * (sex === "female" ? (ex.femaleFactor ?? 0.6) : 1) * 1000) / 1000,
          })),
        );
        await tx.insert(s.strengthStandards).values(rows);
      }
    }
  });

  // Catalogo alimenti: upsert per slug (i valori si aggiornano, gli id restano stabili)
  for (const f of FOOD_CATALOG) {
    await db
      .insert(s.foods)
      .values({ slug: f.slug, ownerId: null, name: f.name, category: f.category, unit: f.unit, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, servingSize: f.servingSize ?? null, servingLabel: f.servingLabel ?? null })
      .onConflictDoUpdate({
        target: s.foods.slug,
        set: { name: f.name, category: f.category, unit: f.unit, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, servingSize: f.servingSize ?? null, servingLabel: f.servingLabel ?? null },
      });
  }

  // sanity check
  const sys = await db.select({ id: s.exercises.id }).from(s.exercises).where(and(isNull(s.exercises.ownerId)));
  console.log(`Seed completato: ${MUSCLES.length} muscoli, ${sys.length} esercizi di sistema, ${FOOD_CATALOG.length} alimenti.`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
