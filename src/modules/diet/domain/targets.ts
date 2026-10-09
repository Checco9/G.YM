import { kcalFromMacros } from "./nutrition";

export type Activity = "sedentary" | "light" | "moderate" | "high";
export type Objective = "lose" | "maintain" | "gain";

export const ACTIVITY: Record<Activity, { label: string; factor: number }> = {
  sedentary: { label: "Sedentario (poco movimento)", factor: 1.2 },
  light: { label: "Leggero (1-3 allenamenti a settimana)", factor: 1.375 },
  moderate: { label: "Moderato (3-5 allenamenti a settimana)", factor: 1.55 },
  high: { label: "Intenso (6-7 allenamenti a settimana)", factor: 1.725 },
};

export const OBJECTIVE: Record<Objective, { label: string; kcalFactor: number; proteinPerKg: number }> = {
  lose: { label: "Perdere peso", kcalFactor: 0.85, proteinPerKg: 2.0 },
  maintain: { label: "Mantenere il peso", kcalFactor: 1, proteinPerKg: 1.6 },
  gain: { label: "Aumentare la massa", kcalFactor: 1.1, proteinPerKg: 1.8 },
};

export type TargetInput = {
  sex: "male" | "female";
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  objective: Objective;
};

/** Metabolismo basale, formula di Mifflin-St Jeor. */
export const bmr = ({ sex, age, heightCm, weightKg }: Pick<TargetInput, "sex" | "age" | "heightCm" | "weightKg">) =>
  10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** Suggerimento orientativo di obiettivi giornalieri. Non sostituisce il parere di un professionista. */
export function suggestTargets(input: TargetInput) {
  const base = bmr(input);
  const tdee = base * ACTIVITY[input.activity].factor;
  const floor = input.sex === "female" ? 1200 : 1500;
  const kcal = Math.max(floor, roundTo(tdee * OBJECTIVE[input.objective].kcalFactor, 10));

  const proteinG = Math.round(input.weightKg * OBJECTIVE[input.objective].proteinPerKg);
  const fatG = Math.round(Math.max(input.weightKg * 0.9, (kcal * 0.25) / 9));
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  const waterMl = Math.min(4000, Math.max(1500, roundTo(input.weightKg * 35, 250)));
  return { kcal, proteinG, carbsG, fatG, waterMl, bmr: Math.round(base), tdee: Math.round(tdee) };
}

/** Ripartisce le calorie in grammi secondo percentuali di proteine / carboidrati / grassi. */
export function splitByPercent(kcal: number, pct: { protein: number; carbs: number; fat: number }) {
  return {
    proteinG: Math.round((kcal * pct.protein) / 100 / 4),
    carbsG: Math.round((kcal * pct.carbs) / 100 / 4),
    fatG: Math.round((kcal * pct.fat) / 100 / 9),
  };
}

export const SPLIT_PRESETS = [
  { label: "Equilibrata", protein: 25, carbs: 45, fat: 30 },
  { label: "Alta proteica", protein: 35, carbs: 35, fat: 30 },
  { label: "Più carboidrati", protein: 20, carbs: 55, fat: 25 },
  { label: "Più grassi", protein: 30, carbs: 30, fat: 40 },
] as const;

/** Differenza tra le calorie obiettivo e quelle date dai macro (in percentuale delle calorie obiettivo). */
export const macroMismatchPercent = (kcal: number, proteinG: number, carbsG: number, fatG: number) =>
  kcal > 0 ? Math.round(((kcalFromMacros(proteinG, carbsG, fatG) - kcal) / kcal) * 100) : 0;
