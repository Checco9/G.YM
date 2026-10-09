import { and, asc, desc, eq, gte, isNull, or, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { addDaysToKey, dayKey } from "@/lib/dates";
import { badRequest, notFound } from "@/lib/errors";
import { dietGoals, foodEntries, foods, waterLogs } from "@/db/schema";
import type { SessionUser } from "@/modules/auth/session";
import { rescale, scale, type Goals, type Meal } from "./domain/nutrition";
import { copySchema, dateSchema, entrySchema, entryUpdateSchema, foodSchema, goalsSchema, waterSchema } from "./schemas";

// ───────── Alimenti ─────────

export type FoodItem = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  unit: "g" | "ml";
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: number | null;
  servingLabel: string | null;
  isCustom: boolean;
};

const foodColumns = {
  id: foods.id,
  name: foods.name,
  brand: foods.brand,
  category: foods.category,
  unit: foods.unit,
  kcal: foods.kcal,
  protein: foods.protein,
  carbs: foods.carbs,
  fat: foods.fat,
  servingSize: foods.servingSize,
  servingLabel: foods.servingLabel,
};

/** Il catalogo di sistema cambia solo con il seed: in cache per un'ora. */
const systemFoods = unstable_cache(
  async (): Promise<FoodItem[]> =>
    (await db().select(foodColumns).from(foods).where(and(isNull(foods.ownerId), isNull(foods.archivedAt))).orderBy(asc(foods.name))).map((f) => ({ ...f, isCustom: false })),
  ["system-foods"],
  { revalidate: 3600, tags: ["catalog"] },
);

export async function listFoods(userId: string): Promise<FoodItem[]> {
  const [system, own] = await Promise.all([
    systemFoods(),
    db().select(foodColumns).from(foods).where(and(eq(foods.ownerId, userId), isNull(foods.archivedAt))).orderBy(asc(foods.name)),
  ]);
  return [...own.map((f) => ({ ...f, isCustom: true })), ...system];
}

export async function listOwnFoods(userId: string): Promise<FoodItem[]> {
  return (await db().select(foodColumns).from(foods).where(and(eq(foods.ownerId, userId), isNull(foods.archivedAt))).orderBy(asc(foods.name))).map((f) => ({ ...f, isCustom: true }));
}

export async function createFood(userId: string, input: unknown): Promise<FoodItem> {
  const d = foodSchema.parse(input);
  const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(foods).where(and(eq(foods.ownerId, userId), isNull(foods.archivedAt)));
  if (n >= 500) throw badRequest("Hai raggiunto il numero massimo di alimenti personali");
  const [row] = await db()
    .insert(foods)
    .values({ ownerId: userId, name: d.name, brand: d.brand || null, unit: d.unit, kcal: d.kcal, protein: d.protein, carbs: d.carbs, fat: d.fat, servingSize: d.servingSize ?? null, servingLabel: d.servingSize ? d.servingLabel || null : null, category: "Personali" })
    .returning(foodColumns);
  return { ...row, isCustom: true };
}

export async function updateFood(userId: string, id: string, input: unknown): Promise<FoodItem> {
  const d = foodSchema.parse(input);
  const [row] = await db()
    .update(foods)
    .set({ name: d.name, brand: d.brand || null, unit: d.unit, kcal: d.kcal, protein: d.protein, carbs: d.carbs, fat: d.fat, servingSize: d.servingSize ?? null, servingLabel: d.servingSize ? d.servingLabel || null : null })
    .where(and(eq(foods.id, id), eq(foods.ownerId, userId), isNull(foods.archivedAt)))
    .returning(foodColumns);
  if (!row) throw notFound("Alimento non trovato");
  return { ...row, isCustom: true };
}

export async function deleteFood(userId: string, id: string) {
  const res = await db().update(foods).set({ archivedAt: new Date() }).where(and(eq(foods.id, id), eq(foods.ownerId, userId))).returning({ id: foods.id });
  if (!res.length) throw notFound("Alimento non trovato");
}

// ───────── Diario ─────────

export type EntryView = {
  id: string;
  meal: Meal;
  foodId: string | null;
  name: string;
  quantity: number;
  unit: "g" | "ml" | "porzione";
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

const entryColumns = {
  id: foodEntries.id,
  meal: foodEntries.meal,
  foodId: foodEntries.foodId,
  name: foodEntries.name,
  quantity: foodEntries.quantity,
  unit: foodEntries.unit,
  kcal: foodEntries.kcal,
  protein: foodEntries.protein,
  carbs: foodEntries.carbs,
  fat: foodEntries.fat,
};

/** Accetta i giorni da un anno fa fino a domani (fuso dell'utente). */
function assertDate(date: string, tz: string) {
  dateSchema.parse(date);
  const today = dayKey(new Date(), tz);
  if (date < addDaysToKey(today, -400) || date > addDaysToKey(today, 1)) throw badRequest("Data non valida");
}

export async function getDay(userId: string, date: string) {
  const [entries, water] = await Promise.all([
    db().select(entryColumns).from(foodEntries).where(and(eq(foodEntries.userId, userId), eq(foodEntries.loggedOn, date))).orderBy(asc(foodEntries.createdAt)),
    db().select({ ml: waterLogs.ml }).from(waterLogs).where(and(eq(waterLogs.userId, userId), eq(waterLogs.loggedOn, date))).limit(1),
  ]);
  return { entries: entries as EntryView[], waterMl: water[0]?.ml ?? 0 };
}

export type RecentFood = Pick<EntryView, "foodId" | "name" | "quantity" | "unit" | "kcal" | "protein" | "carbs" | "fat">;

/** Ultimi alimenti registrati (uno per alimento), per aggiungerli di nuovo con un tocco. */
export async function listRecents(userId: string): Promise<RecentFood[]> {
  const since = new Date(Date.now() - 60 * 86400000);
  const rows = await db()
    .selectDistinctOn([foodEntries.foodId], { ...entryColumns, createdAt: foodEntries.createdAt })
    .from(foodEntries)
    .where(and(eq(foodEntries.userId, userId), gte(foodEntries.createdAt, since), sql`${foodEntries.foodId} is not null`))
    .orderBy(foodEntries.foodId, desc(foodEntries.createdAt));
  return rows
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 12)
    .map(({ id: _id, meal: _meal, createdAt: _c, ...r }) => r);
}

export async function addEntry(user: SessionUser, input: unknown): Promise<EntryView> {
  const d = entrySchema.parse(input);
  assertDate(d.date, user.timezone);
  const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(foodEntries).where(and(eq(foodEntries.userId, user.id), eq(foodEntries.loggedOn, d.date)));
  if (n >= 200) throw badRequest("Troppi elementi in un solo giorno");

  let values: { name: string; unit: EntryView["unit"]; foodId: string | null; kcal: number; protein: number; carbs: number; fat: number };
  if (d.foodId) {
    const [f] = await db()
      .select(foodColumns)
      .from(foods)
      .where(and(eq(foods.id, d.foodId), isNull(foods.archivedAt), or(isNull(foods.ownerId), eq(foods.ownerId, user.id))))
      .limit(1);
    if (!f) throw notFound("Alimento non trovato");
    values = { name: f.brand ? `${f.name} (${f.brand})` : f.name, unit: f.unit, foodId: f.id, ...scale(f, d.quantity) };
  } else {
    const m = d.manual!;
    values = { name: m.name, unit: "porzione", foodId: null, kcal: m.kcal * d.quantity, protein: m.protein * d.quantity, carbs: m.carbs * d.quantity, fat: m.fat * d.quantity };
  }
  const [row] = await db().insert(foodEntries).values({ userId: user.id, loggedOn: d.date, meal: d.meal, quantity: d.quantity, ...values }).returning(entryColumns);
  return row as EntryView;
}

export async function updateEntry(userId: string, id: string, input: unknown): Promise<EntryView> {
  const { quantity } = entryUpdateSchema.parse(input);
  const [cur] = await db().select(entryColumns).from(foodEntries).where(and(eq(foodEntries.id, id), eq(foodEntries.userId, userId))).limit(1);
  if (!cur) throw notFound("Elemento non trovato");
  const [row] = await db()
    .update(foodEntries)
    .set({ quantity, ...rescale(cur, quantity) })
    .where(and(eq(foodEntries.id, id), eq(foodEntries.userId, userId)))
    .returning(entryColumns);
  return row as EntryView;
}

export async function deleteEntry(userId: string, id: string) {
  const res = await db().delete(foodEntries).where(and(eq(foodEntries.id, id), eq(foodEntries.userId, userId))).returning({ id: foodEntries.id });
  if (!res.length) throw notFound("Elemento non trovato");
}

/** Copia i pasti di un altro giorno (o un solo pasto) nel giorno indicato. */
export async function copyEntries(user: SessionUser, input: unknown): Promise<EntryView[]> {
  const d = copySchema.parse(input);
  assertDate(d.fromDate, user.timezone);
  assertDate(d.toDate, user.timezone);
  if (d.fromDate === d.toDate) throw badRequest("Scegli un giorno diverso");
  const rows = await db().execute(sql`
    insert into food_entries (user_id, logged_on, meal, food_id, name, quantity, unit, kcal, protein, carbs, fat)
    select user_id, ${d.toDate}::date, meal, food_id, name, quantity, unit, kcal, protein, carbs, fat
    from food_entries
    where user_id = ${user.id} and logged_on = ${d.fromDate}::date ${d.meal ? sql`and meal = ${d.meal}` : sql``}
    returning id, meal, food_id as "foodId", name, quantity, unit, kcal, protein, carbs, fat`);
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    meal: r.meal as Meal,
    foodId: (r.foodId as string | null) ?? null,
    name: String(r.name),
    quantity: Number(r.quantity),
    unit: r.unit as EntryView["unit"],
    kcal: Number(r.kcal),
    protein: Number(r.protein),
    carbs: Number(r.carbs),
    fat: Number(r.fat),
  }));
}

// ───────── Acqua ─────────

export async function addWater(user: SessionUser, input: unknown): Promise<{ ml: number }> {
  const { date, delta } = waterSchema.parse(input);
  assertDate(date, user.timezone);
  const [row] = await db()
    .insert(waterLogs)
    .values({ userId: user.id, loggedOn: date, ml: Math.max(0, delta) })
    .onConflictDoUpdate({ target: [waterLogs.userId, waterLogs.loggedOn], set: { ml: sql`greatest(0, least(10000, ${waterLogs.ml} + ${delta}))` } })
    .returning({ ml: waterLogs.ml });
  return { ml: row.ml };
}

// ───────── Obiettivi ─────────

export async function getGoals(userId: string): Promise<Goals | null> {
  const [g] = await db()
    .select({ kcal: dietGoals.kcal, proteinG: dietGoals.proteinG, carbsG: dietGoals.carbsG, fatG: dietGoals.fatG, waterMl: dietGoals.waterMl })
    .from(dietGoals)
    .where(eq(dietGoals.userId, userId))
    .limit(1);
  return g ?? null;
}

export async function saveGoals(userId: string, input: unknown) {
  const g = goalsSchema.parse(input);
  await db()
    .insert(dietGoals)
    .values({ userId, ...g })
    .onConflictDoUpdate({ target: dietGoals.userId, set: { ...g, updatedAt: new Date() } });
}

// ───────── Andamento e riepilogo ─────────

export type TrendDay = { date: string; kcal: number; protein: number; carbs: number; fat: number; waterMl: number; logged: boolean };

export async function getTrends(user: SessionUser, days: number) {
  const today = dayKey(new Date(), user.timezone);
  const from = addDaysToKey(today, -(days - 1));
  const [rows, water, goals] = await Promise.all([
    db()
      .select({
        day: foodEntries.loggedOn,
        kcal: sql<number>`sum(${foodEntries.kcal})::float8`,
        protein: sql<number>`sum(${foodEntries.protein})::float8`,
        carbs: sql<number>`sum(${foodEntries.carbs})::float8`,
        fat: sql<number>`sum(${foodEntries.fat})::float8`,
      })
      .from(foodEntries)
      .where(and(eq(foodEntries.userId, user.id), gte(foodEntries.loggedOn, from)))
      .groupBy(foodEntries.loggedOn),
    db().select({ day: waterLogs.loggedOn, ml: waterLogs.ml }).from(waterLogs).where(and(eq(waterLogs.userId, user.id), gte(waterLogs.loggedOn, from))),
    getGoals(user.id),
  ]);
  const series: TrendDay[] = Array.from({ length: days }, (_, i) => {
    const date = addDaysToKey(from, i);
    const r = rows.find((x) => x.day === date);
    return {
      date,
      kcal: Math.round(r?.kcal ?? 0),
      protein: Math.round(r?.protein ?? 0),
      carbs: Math.round(r?.carbs ?? 0),
      fat: Math.round(r?.fat ?? 0),
      waterMl: water.find((w) => w.day === date)?.ml ?? 0,
      logged: Boolean(r),
    };
  });
  const logged = series.filter((d) => d.logged);
  const avg = (f: (d: TrendDay) => number) => (logged.length ? Math.round(logged.reduce((n, d) => n + f(d), 0) / logged.length) : 0);
  const onTarget = goals ? logged.filter((d) => Math.abs(d.kcal - goals.kcal) <= goals.kcal * 0.1).length : 0;
  const waterDays = series.filter((d) => d.waterMl > 0);
  return {
    series,
    goals,
    loggedDays: logged.length,
    onTargetDays: onTarget,
    avg: { kcal: avg((d) => d.kcal), protein: avg((d) => d.protein), carbs: avg((d) => d.carbs), fat: avg((d) => d.fat) },
    avgWaterMl: waterDays.length ? Math.round(waterDays.reduce((n, d) => n + d.waterMl, 0) / waterDays.length) : 0,
  };
}

/** Per la Home: una sola query. Restituisce null se l'utente non ha ancora impostato gli obiettivi. */
export async function getTodaySummary(userId: string, today: string): Promise<{ goal: number; consumed: number } | null> {
  const rows = (await db().execute(sql`
    select g.kcal::int as goal,
      (select coalesce(sum(kcal), 0)::float8 from food_entries where user_id = ${userId} and logged_on = ${today}::date) as consumed
    from diet_goals g where g.user_id = ${userId}`)) as unknown as { goal: number; consumed: number }[];
  return rows[0] ? { goal: Number(rows[0].goal), consumed: Math.round(Number(rows[0].consumed)) } : null;
}

