export type Per100 = { kcal: number; protein: number; carbs: number; fat: number };
export type Nutrition = Per100;
export type Goals = { kcal: number; proteinG: number; carbsG: number; fatG: number; waterMl: number };

export const MEALS = [
  { key: "breakfast", label: "Colazione" },
  { key: "lunch", label: "Pranzo" },
  { key: "dinner", label: "Cena" },
  { key: "snack", label: "Spuntini" },
] as const;
export type Meal = (typeof MEALS)[number]["key"];
export const MEAL_KEYS = MEALS.map((m) => m.key) as [Meal, ...Meal[]];

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Valori nutrizionali per una quantità (in g o ml) di un alimento con valori per 100. */
export function scale(per100: Per100, quantity: number): Nutrition {
  const k = quantity / 100;
  return { kcal: r1(per100.kcal * k), protein: r1(per100.protein * k), carbs: r1(per100.carbs * k), fat: r1(per100.fat * k) };
}

export function addUp(items: Nutrition[]): Nutrition {
  const t = items.reduce((a, i) => ({ kcal: a.kcal + i.kcal, protein: a.protein + i.protein, carbs: a.carbs + i.carbs, fat: a.fat + i.fat }), {
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
  return { kcal: r1(t.kcal), protein: r1(t.protein), carbs: r1(t.carbs), fat: r1(t.fat) };
}

/** Calorie ricavate dai macronutrienti (4 / 4 / 9 kcal per grammo). */
export const kcalFromMacros = (protein: number, carbs: number, fat: number) => Math.round(protein * 4 + carbs * 4 + fat * 9);

/** Ricalcola un'annotazione del diario per una nuova quantità, partendo dai valori già salvati. */
export function rescale(entry: Nutrition & { quantity: number }, newQuantity: number): Nutrition {
  if (entry.quantity <= 0) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const k = newQuantity / entry.quantity;
  return { kcal: r2(entry.kcal * k), protein: r2(entry.protein * k), carbs: r2(entry.carbs * k), fat: r2(entry.fat * k) };
}

export type MacroProgress = { key: "protein" | "carbs" | "fat"; label: string; value: number; goal: number; percent: number; over: boolean };

export function dayProgress(total: Nutrition, goals: Goals | null) {
  if (!goals) return null;
  const macro = (key: MacroProgress["key"], label: string, value: number, goal: number): MacroProgress => ({
    key,
    label,
    value: Math.round(value),
    goal,
    percent: goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0,
    over: goal > 0 && value > goal * 1.05,
  });
  return {
    kcalRemaining: Math.round(goals.kcal - total.kcal),
    kcalPercent: goals.kcal > 0 ? Math.min(100, Math.round((total.kcal / goals.kcal) * 100)) : 0,
    over: total.kcal > goals.kcal * 1.05,
    macros: [
      macro("protein", "Proteine", total.protein, goals.proteinG),
      macro("carbs", "Carboidrati", total.carbs, goals.carbsG),
      macro("fat", "Grassi", total.fat, goals.fatG),
    ],
  };
}
